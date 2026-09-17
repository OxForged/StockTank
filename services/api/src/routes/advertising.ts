import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@stocktank/database';
import {
  advertisingInquiryRequestSchema,
  recordImpressionRequestSchema,
  serveAdQuerySchema,
  type InquiryReceivedResponse,
  type MediaKitResponse,
  type PlacementKey,
  type ServeAdResponse,
} from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import {
  AD_TOKEN_TTL_SECONDS,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE_MS,
  frequencyKey,
  newVisitorId,
  selectAd,
  signAdToken,
  verifyAdToken,
  visitorHash,
} from '../lib/ads.js';
import { writeAudit } from '../lib/audit.js';
import { sha256Hex } from '../lib/crypto.js';
import type { EmailProvider } from '../lib/email.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export interface AdvertisingDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  redis: Redis | null;
  logger: Logger;
  email: EmailProvider;
  /** Overridable for tests. */
  inquiryLimit?: { windowMs: number; limit: number };
}

const BUDGET_LABELS: Record<string, string> = {
  under_5k: 'Under $5k',
  from_5k_to_25k: '$5k–$25k',
  from_25k_to_100k: '$25k–$100k',
  over_100k: 'Over $100k',
  undisclosed: 'Prefer not to say',
};

const RECEIVED: InquiryReceivedResponse = { status: 'received' };

export const adTokenParamsSchema = z.object({ token: z.string().min(10).max(2048) });

export function advertisingRouter({ env, prisma, redis, logger, email, inquiryLimit }: AdvertisingDeps): Router {
  const router = Router();

  // ───── Media kit (public rate card) ─────
  router.get('/advertising/media-kit', async (_req, res) => {
    const [placements, flag] = await Promise.all([
      prisma.adPlacement.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.featureFlag.findUnique({ where: { key: 'advertising' }, select: { enabled: true } }),
    ]);
    const response: MediaKitResponse = {
      placements: placements.map((p) => ({
        key: p.key as PlacementKey,
        name: p.name,
        description: p.description,
        surface: p.surface,
        format: p.format,
        specs: p.specs,
        pricingModel: p.pricingModel,
        // Rates stay private unless sales publishes them.
        rateCents: p.rateVisibility === 'public' ? p.rateCents : null,
        currency: p.currency,
        rateVisibility: p.rateVisibility,
      })),
      advertisingLive: flag?.enabled ?? false,
    };
    res.set('Cache-Control', 'public, max-age=60');
    res.json(response);
  });

  // ───── Serving ─────
  router.get('/ads/serve', async (req, res) => {
    const query = validate(serveAdQuerySchema, req.query, 'query');
    res.set('Cache-Control', 'private, no-store');

    let visitorId: string | undefined = typeof req.cookies?.[VISITOR_COOKIE] === 'string' ? req.cookies[VISITOR_COOKIE] : undefined;
    if (!visitorHash(visitorId)) {
      visitorId = newVisitorId();
      res.cookie(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: VISITOR_COOKIE_MAX_AGE_MS,
      });
    }
    const vHash = visitorHash(visitorId);

    const selected = await selectAd(prisma, redis, logger, { placementKey: query.placement, visitorHash: vHash });
    if (!selected) {
      const empty: ServeAdResponse = { ad: null };
      res.json(empty);
      return;
    }
    const token = signAdToken(env.SESSION_SECRET, {
      i: newVisitorId(),
      c: selected.campaignId,
      r: selected.creativeId,
      p: selected.placementId,
      v: vHash,
      u: req.auth?.user.id ?? null,
      path: query.path ?? null,
      exp: Math.floor(Date.now() / 1000) + AD_TOKEN_TTL_SECONDS,
    });
    const response: ServeAdResponse = {
      ad: {
        ...selected.ad,
        clickUrl: `/api/v1/ads/click/${encodeURIComponent(token)}`,
        impressionToken: token,
      },
    };
    res.json(response);
  });

  /** Records a viewable impression. Idempotent per token; invalid or expired tokens are ignored. */
  router.post('/ads/impressions', async (req, res) => {
    const { token } = validate(recordImpressionRequestSchema, req.body, 'body');
    const payload = verifyAdToken(env.SESSION_SECRET, token);
    if (!payload) throw errors.badRequest('Invalid or expired ad token');

    let result: { count: number };
    try {
      result = await prisma.adImpression.createMany({
      data: [
        {
          id: payload.i,
          campaignId: payload.c,
          creativeId: payload.r,
          placementId: payload.p,
          visitorHash: payload.v,
          userId: payload.u,
          pagePath: payload.path,
        },
      ],
      skipDuplicates: true,
      });
    } catch (err) {
      // The campaign/creative was deleted after serving: nothing to record.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        res.status(204).end();
        return;
      }
      throw err;
    }

    if (result.count > 0 && payload.v && redis) {
      const key = frequencyKey(payload.c, payload.v, new Date());
      try {
        await redis.multi().incr(key).expire(key, 2 * 24 * 60 * 60).exec();
      } catch (err) {
        logger.warn({ err: { message: (err as Error).message } }, 'Frequency counter not updated');
      }
    }
    res.status(204).end();
  });

  /** Click tracking. Redirects only to the destination stored on the creative (no open redirect). */
  router.get('/ads/click/:token', async (req, res) => {
    const { token } = validate(adTokenParamsSchema, req.params, 'params');
    const payload = verifyAdToken(env.SESSION_SECRET, token);
    if (!payload) throw errors.notFound('This ad link has expired');

    const creative = await prisma.creativeAsset.findUnique({
      where: { id: payload.r },
      select: { clickUrl: true, campaignId: true },
    });
    if (!creative || creative.campaignId !== payload.c || !/^https?:\/\//i.test(creative.clickUrl)) {
      throw errors.notFound('This ad link is no longer available');
    }

    await prisma.adClick.create({
      data: {
        impressionId: payload.i,
        campaignId: payload.c,
        creativeId: payload.r,
        placementId: payload.p,
        visitorHash: payload.v,
        userId: req.auth?.user.id ?? payload.u,
      },
    });
    res.set('Cache-Control', 'private, no-store');
    res.set('Referrer-Policy', 'origin');
    res.redirect(302, creative.clickUrl);
  });

  // ───── Advertise with StockTank: inbound leads ─────
  const inquiryRateLimit = rateLimit({
    windowMs: inquiryLimit?.windowMs ?? 60 * 60 * 1000,
    limit: inquiryLimit?.limit ?? 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: (_req, _res, next) => next(errors.rateLimited()),
  });

  router.post('/advertising/inquiries', inquiryRateLimit, async (req, res) => {
    const body = validate(advertisingInquiryRequestSchema, req.body, 'body');
    // Honeypot filled: accept silently so bots learn nothing, store nothing.
    if (body.companyFax) {
      res.status(202).json(RECEIVED);
      return;
    }

    const inquiry = await prisma.advertisingInquiry.create({
      data: {
        company: body.company,
        contactName: body.contactName,
        email: body.email.toLowerCase(),
        website: body.website ?? null,
        budgetRange: body.budgetRange,
        placementKeys: body.placementKeys,
        message: body.message,
        utmSource: body.utm?.source ?? null,
        utmMedium: body.utm?.medium ?? null,
        utmCampaign: body.utm?.campaign ?? null,
        referrer: body.referrer ?? null,
        ipHash: req.ip ? sha256Hex(`ip:${req.ip}`).slice(0, 32) : null,
      },
      select: { id: true },
    });
    await writeAudit(prisma, req, {
      action: 'advertising.inquiry.create',
      actorId: req.auth?.user.id ?? null,
      targetType: 'advertising_inquiry',
      targetId: inquiry.id,
    });

    if (env.SALES_NOTIFY_EMAIL && email.canSend) {
      try {
        await email.send({
          to: env.SALES_NOTIFY_EMAIL,
          subject: `New advertising inquiry: ${body.company}`,
          text: [
            `Company: ${body.company}`,
            `Contact: ${body.contactName} <${body.email}>`,
            `Website: ${body.website ?? '—'}`,
            `Budget: ${BUDGET_LABELS[body.budgetRange] ?? body.budgetRange}`,
            `Placements: ${body.placementKeys.join(', ') || '—'}`,
            '',
            body.message,
            '',
            `Open in admin: inquiry ${inquiry.id}`,
          ].join('\n'),
        });
      } catch (err) {
        // The lead is saved; a failed notification must not lose it or fail the request.
        logger.error({ err: { message: (err as Error).message }, inquiryId: inquiry.id }, 'Sales notification failed');
      }
    }
    res.status(202).json(RECEIVED);
  });

  return router;
}
