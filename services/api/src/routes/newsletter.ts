import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Logger } from 'pino';
import type { PrismaClient } from '@stocktank/database';
import {
  newsletterSubscribeRequestSchema,
  newsletterTokenRequestSchema,
  type NewsletterTokenResponse,
} from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import { sha256Hex } from '../lib/crypto.js';
import { EmailNotConfiguredError, type EmailProvider } from '../lib/email.js';
import { AppError, errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export interface NewsletterDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  logger: Logger;
  email: EmailProvider;
  subscribeLimit?: { windowMs: number; limit: number };
}

/** A confirmation email is re-sent at most this often per address. */
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INBOX = { status: 'check_inbox' } as const;

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newsletterRouter({ env, prisma, logger, email, subscribeLimit }: NewsletterDeps): Router {
  const router = Router();
  const webUrl = env.PUBLIC_WEB_URL.replace(/\/$/, '');

  const limiter = rateLimit({
    windowMs: subscribeLimit?.windowMs ?? 15 * 60 * 1000,
    limit: subscribeLimit?.limit ?? 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: (_req, _res, next) => next(errors.rateLimited()),
  });

  /**
   * Double opt-in. The response never reveals whether an address is already subscribed.
   * If no email provider is configured the request fails with 503 rather than pretending.
   */
  router.post('/subscribe', limiter, async (req, res) => {
    const body = validate(newsletterSubscribeRequestSchema, req.body, 'body');
    if (body.website) {
      res.status(202).json(CHECK_INBOX);
      return;
    }
    if (!email.canSend) {
      throw new AppError('INTERNAL', 'Newsletter sign-up is temporarily unavailable', undefined, 503);
    }

    const address = body.email.trim().toLowerCase();
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: address } });
    if (existing?.status === 'confirmed') {
      res.status(202).json(CHECK_INBOX);
      return;
    }
    if (existing?.confirmSentAt && Date.now() - existing.confirmSentAt.getTime() < RESEND_COOLDOWN_MS) {
      res.status(202).json(CHECK_INBOX);
      return;
    }

    const confirmToken = newToken();
    const unsubscribeToken = newToken();
    const now = new Date();
    const data = {
      status: 'pending' as const,
      source: body.source ?? null,
      utmSource: body.utm?.source ?? null,
      utmMedium: body.utm?.medium ?? null,
      utmCampaign: body.utm?.campaign ?? null,
      consentAt: now,
      confirmTokenHash: sha256Hex(confirmToken),
      confirmSentAt: now,
      unsubscribeTokenHash: sha256Hex(unsubscribeToken),
      unsubscribedAt: null,
    };
    await prisma.newsletterSubscriber.upsert({
      where: { email: address },
      create: { email: address, ...data },
      update: data,
    });

    try {
      await email.send({
        to: address,
        subject: 'Confirm your StockTank newsletter subscription',
        text: [
          'Confirm your subscription to the StockTank newsletter:',
          `${webUrl}/newsletter/confirm?token=${confirmToken}`,
          '',
          'If you did not request this, ignore this email and you will not be subscribed.',
          '',
          `Unsubscribe at any time: ${webUrl}/newsletter/unsubscribe?token=${unsubscribeToken}`,
          '',
          'StockTank is a media company. Content is informational and not financial advice.',
        ].join('\n'),
      });
    } catch (err) {
      logger.error({ err: { message: (err as Error).message } }, 'Newsletter confirmation email failed');
      if (err instanceof EmailNotConfiguredError) {
        throw new AppError('INTERNAL', 'Newsletter sign-up is temporarily unavailable', undefined, 503);
      }
      throw new AppError('INTERNAL', 'We could not send the confirmation email. Please try again shortly.', undefined, 503);
    }
    res.status(202).json(CHECK_INBOX);
  });

  router.post('/confirm', async (req, res) => {
    const { token } = validate(newsletterTokenRequestSchema, req.body, 'body');
    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { confirmTokenHash: sha256Hex(token) } });
    if (!subscriber || !subscriber.confirmSentAt || Date.now() - subscriber.confirmSentAt.getTime() > CONFIRM_TOKEN_TTL_MS) {
      throw errors.notFound('This confirmation link is invalid or has expired');
    }
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null },
    });
    const response: NewsletterTokenResponse = { status: 'confirmed' };
    res.json(response);
  });

  router.post('/unsubscribe', async (req, res) => {
    const { token } = validate(newsletterTokenRequestSchema, req.body, 'body');
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeTokenHash: sha256Hex(token) },
    });
    if (!subscriber) throw errors.notFound('This unsubscribe link is invalid');
    if (subscriber.status !== 'unsubscribed') {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: 'unsubscribed', unsubscribedAt: new Date(), confirmTokenHash: null },
      });
    }
    const response: NewsletterTokenResponse = { status: 'unsubscribed' };
    res.json(response);
  });

  return router;
}
