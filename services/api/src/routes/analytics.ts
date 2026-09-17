import type { Request, Response } from 'express';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@stocktank/database';
import { assetRenditionsSchema } from '@stocktank/media';
import { analyticsBatchSchema } from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE_MS, newVisitorId, visitorHash } from '../lib/ads.js';
import { PUBLISHED } from '../lib/content.js';
import { sha256Hex } from '../lib/crypto.js';
import { errors } from '../lib/errors.js';
import type { MediaService } from '../lib/media.js';
import { validate } from '../lib/validate.js';

export interface AnalyticsDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  media: MediaService;
  /** Batches per IP per minute; overridable for tests. */
  ingestLimit?: { windowMs: number; limit: number };
}

/** Global Privacy Control and Do Not Track are honoured: nothing is recorded. */
export function trackingOptedOut(req: Request): boolean {
  return req.get('sec-gpc') === '1' || req.get('dnt') === '1';
}

const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function referrerHost(raw: string | undefined, ownHost: string): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return host && host !== ownHost ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

/** Public, anonymous analytics ingestion and tracked podcast downloads (§29). */
export function analyticsRouter({ env, prisma, media, ingestLimit }: AnalyticsDeps): Router {
  const router = Router();
  const ownHost = new URL(env.PUBLIC_WEB_URL).hostname.toLowerCase().replace(/^www\./, '');

  const limiter = rateLimit({
    windowMs: ingestLimit?.windowMs ?? 60_000,
    limit: ingestLimit?.limit ?? 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: (_req, _res, next) => next(errors.rateLimited()),
  });

  const visitorFor = (req: Request, res: Response): string => {
    let id: string | undefined = typeof req.cookies?.[VISITOR_COOKIE] === 'string' ? req.cookies[VISITOR_COOKIE] : undefined;
    if (!visitorHash(id)) {
      id = newVisitorId();
      res.cookie(VISITOR_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/', maxAge: VISITOR_COOKIE_MAX_AGE_MS });
    }
    return visitorHash(id)!;
  };

  router.post('/analytics/events', limiter, async (req, res) => {
    const body = validate(analyticsBatchSchema, req.body, 'body');
    res.set('Cache-Control', 'private, no-store');
    if (trackingOptedOut(req)) {
      res.status(204).end();
      return;
    }
    const visitor = visitorFor(req, res);
    const now = Date.now();

    // Show ids are derived here, never trusted from the client.
    const episodeIds = [...new Set(body.events.filter((e) => e.entityType === 'episode' && e.entityId).map((e) => e.entityId!))];
    const clipIds = [...new Set(body.events.filter((e) => e.entityType === 'clip' && e.entityId).map((e) => e.entityId!))];
    const showIds = [...new Set(body.events.filter((e) => e.entityType === 'show' && e.entityId).map((e) => e.entityId!))];
    const [episodes, clips, shows] = await Promise.all([
      episodeIds.length ? prisma.episode.findMany({ where: { id: { in: episodeIds } }, select: { id: true, showId: true } }) : [],
      clipIds.length ? prisma.clip.findMany({ where: { id: { in: clipIds } }, select: { id: true, sourceEpisode: { select: { showId: true } } } }) : [],
      showIds.length ? prisma.show.findMany({ where: { id: { in: showIds } }, select: { id: true } }) : [],
    ]);
    const showOf = new Map<string, string>([
      ...episodes.map((e) => [`episode:${e.id}`, e.showId] as const),
      ...clips.map((c) => [`clip:${c.id}`, c.sourceEpisode.showId] as const),
      ...shows.map((s) => [`show:${s.id}`, s.id] as const),
    ]);

    const referrer = referrerHost(body.referrer, ownHost);
    const data: Prisma.AnalyticsEventCreateManyInput[] = body.events.map((e) => {
      const at = e.occurredAt ? new Date(e.occurredAt).getTime() : now;
      const occurredAt = new Date(at > now || now - at > MAX_CLOCK_SKEW_MS ? now : at);
      const key = e.entityType && e.entityId ? `${e.entityType}:${e.entityId}` : null;
      return {
        type: e.type,
        occurredAt,
        visitorHash: visitor,
        path: e.path?.split('?')[0]?.slice(0, 300) ?? null,
        referrerHost: referrer,
        utmSource: body.utm?.source?.toLowerCase() ?? null,
        utmMedium: body.utm?.medium?.toLowerCase() ?? null,
        utmCampaign: body.utm?.campaign ?? null,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        showId: key ? (showOf.get(key) ?? null) : null,
        mediaKind: e.mediaKind ?? null,
        seconds: e.type === 'play_progress' ? (e.seconds ?? null) : null,
        query: e.type === 'search' ? (e.query?.toLowerCase().replace(/\s+/g, ' ') ?? null) : null,
        channel: e.type === 'share' ? (e.channel ?? null) : null,
      };
    });
    await prisma.analyticsEvent.createMany({ data });
    res.status(204).end();
  });

  /**
   * Podcast enclosure URL. Counts a download (one per listener per episode per day, IP never stored) and redirects
   * to the CDN file. Podcast apps request byte ranges repeatedly; only requests from the start of the file count.
   */
  const download = async (req: Request, res: Response) => {
    const { episodeId } = validate(z.object({ episodeId: z.string().min(1).max(64) }), req.params, 'params');
    const episode = await prisma.episode.findFirst({
      where: { id: episodeId, status: PUBLISHED, show: { status: PUBLISHED }, mediaAsset: { status: 'ready' } },
      select: { id: true, showId: true, mediaAsset: { select: { renditions: true } } },
    });
    const parsed = assetRenditionsSchema.safeParse(episode?.mediaAsset?.renditions);
    const target = parsed.success ? media.publicUrl(parsed.data.audio) : null;
    if (!episode || !target) throw errors.notFound('Episode audio not found');

    const range = req.get('range');
    const fromStart = !range || /^bytes=0-/.test(range.trim());
    if (req.method === 'GET' && fromStart && !trackingOptedOut(req)) {
      const day = new Date().toISOString().slice(0, 10);
      const visitor = sha256Hex(`download:${req.ip ?? ''}|${req.get('user-agent') ?? ''}|${day}|${env.SESSION_SECRET}`);
      const startOfDay = new Date(`${day}T00:00:00.000Z`);
      const seen = await prisma.analyticsEvent.findFirst({
        where: { type: 'download', entityType: 'episode', entityId: episode.id, visitorHash: visitor, occurredAt: { gte: startOfDay } },
        select: { id: true },
      });
      if (!seen) {
        await prisma.analyticsEvent.create({
          data: { type: 'download', visitorHash: visitor, entityType: 'episode', entityId: episode.id, showId: episode.showId, mediaKind: 'audio' },
        });
      }
    }
    res.set('Cache-Control', 'private, no-store');
    res.redirect(302, target);
  };
  router.get('/podcasts/dl/:episodeId.mp3', download);
  router.head('/podcasts/dl/:episodeId.mp3', download);

  return router;
}
