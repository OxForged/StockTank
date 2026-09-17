import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@stocktank/database';
import { assetRenditionsSchema } from '@stocktank/media';
import { CastopodError, type PodcastHostAdapter } from '@stocktank/podcast';
import {
  podcastEpisodeTypeInputSchema,
  showPodcastSettingsInputSchema,
  type AdminPodcastEpisode,
  type AdminPodcastShow,
  type CastopodPodcastOption,
  type PodcastStatusResponse,
} from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import { writeAudit } from '../lib/audit.js';
import { AppError, errors } from '../lib/errors.js';
import type { MediaService } from '../lib/media.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';
import { podcastFeedUrl } from './podcasts.js';

export interface AdminPodcastDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  media: MediaService;
  podcastHost: PodcastHostAdapter | null;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const unavailable = (what: string) => new AppError('INTERNAL', `${what} is not configured on this server`, undefined, 503);
const upstream = (err: CastopodError) => new AppError('INTERNAL', err.message, undefined, 502);

const showSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  isDemo: true,
  coverUrl: true,
  description: true,
  tagline: true,
  podcastEnabled: true,
  podcastAuthor: true,
  podcastCategory: true,
  podcastSubcategory: true,
  podcastExplicit: true,
  podcastLanguage: true,
  castopodPodcastId: true,
} satisfies Prisma.ShowSelect;

const episodeSelect = {
  id: true,
  title: true,
  slug: true,
  number: true,
  status: true,
  publishedAt: true,
  episodeType: true,
  castopodEpisodeId: true,
  podcastSyncStatus: true,
  podcastSyncError: true,
  podcastSyncedAt: true,
  mediaAsset: { select: { status: true, renditions: true } },
} satisfies Prisma.EpisodeSelect;
type EpisodeRow = Prisma.EpisodeGetPayload<{ select: typeof episodeSelect }>;

const hasAudio = (e: EpisodeRow) => {
  if (e.mediaAsset?.status !== 'ready') return false;
  const parsed = assetRenditionsSchema.safeParse(e.mediaAsset.renditions);
  return parsed.success && Boolean(parsed.data.audio);
};

export function adminPodcastRouter({ env, prisma, media, podcastHost }: AdminPodcastDeps): Router {
  const router = Router();
  const read = requirePermission('content.read_drafts');
  const publish = requirePermission('distribution.publish');

  const audit = (req: Request, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonObject) =>
    writeAudit(prisma, req, { action: `content.podcast.${action}` as const, actorId: getAuth(req).user.id, targetType, targetId, ...(metadata ? { metadata } : {}) });

  const toEpisode = (e: EpisodeRow): AdminPodcastEpisode => {
    const audio = hasAudio(e);
    return {
      id: e.id,
      title: e.title,
      slug: e.slug,
      number: e.number,
      status: e.status,
      publishedAt: e.publishedAt?.toISOString() ?? null,
      episodeType: e.episodeType,
      hasAudio: audio,
      inFeed: audio && e.status === 'published' && e.publishedAt !== null && e.publishedAt <= new Date(),
      castopodEpisodeId: e.castopodEpisodeId,
      podcastSyncStatus: e.podcastSyncStatus,
      podcastSyncError: e.podcastSyncError,
      podcastSyncedAt: e.podcastSyncedAt?.toISOString() ?? null,
    };
  };

  const loadShow = async (id: string): Promise<AdminPodcastShow> => {
    const show = await prisma.show.findUnique({ where: { id }, select: showSelect });
    if (!show) throw errors.notFound('Show not found');
    const episodes = await prisma.episode.findMany({ where: { showId: id, status: 'published' }, select: episodeSelect });
    const feedEpisodes = episodes.map(toEpisode).filter((e) => e.inFeed).length;
    const warnings: string[] = [];
    if (show.podcastEnabled) {
      if (show.status !== 'published') warnings.push('The show is not published, so the feed is offline.');
      if (!show.coverUrl) warnings.push('Add cover art (square JPG or PNG, 1400–3000 px). Apple Podcasts requires it.');
      if (!show.description && !show.tagline) warnings.push('Add a show description.');
      if (!env.PODCAST_OWNER_EMAIL) warnings.push('PODCAST_OWNER_EMAIL is not set; directories use it to verify ownership.');
      if (feedEpisodes === 0) warnings.push('No published episode has processed audio yet, so the feed is empty.');
      if (show.isDemo) warnings.push('DEMO show: the feed is labeled and blocked from podcast directories.');
    }
    return {
      id: show.id,
      slug: show.slug,
      title: show.title,
      status: show.status,
      isDemo: show.isDemo,
      coverUrl: show.coverUrl,
      podcastEnabled: show.podcastEnabled,
      podcastAuthor: show.podcastAuthor,
      podcastCategory: show.podcastCategory,
      podcastSubcategory: show.podcastSubcategory,
      podcastExplicit: show.podcastExplicit,
      podcastLanguage: show.podcastLanguage,
      castopodPodcastId: show.castopodPodcastId,
      feedUrl: show.podcastEnabled && show.status === 'published' ? podcastFeedUrl(env, show.slug) : null,
      publishedEpisodes: episodes.length,
      feedEpisodes,
      warnings,
    };
  };

  router.get('/status', read, (_req, res) => {
    const response: PodcastStatusResponse = {
      castopodConfigured: podcastHost !== null,
      queueConfigured: media.queue !== null,
      ownerEmailConfigured: Boolean(env.PODCAST_OWNER_EMAIL),
    };
    res.json(response);
  });

  router.get('/shows', read, async (_req, res) => {
    const shows = await prisma.show.findMany({ select: { id: true }, orderBy: { title: 'asc' }, take: 200 });
    res.json({ items: await Promise.all(shows.map((s) => loadShow(s.id))) });
  });

  router.put('/shows/:id', publish, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(showPodcastSettingsInputSchema, req.body, 'body');
    const existing = await prisma.show.findUnique({ where: { id }, select: { castopodPodcastId: true } });
    if (!existing) throw errors.notFound('Show not found');
    const castopodPodcastId = body.castopodPodcastId ?? null;
    if (castopodPodcastId !== null && castopodPodcastId !== existing.castopodPodcastId) {
      if (!podcastHost) throw errors.badRequest('Castopod is not configured, so a Castopod podcast cannot be linked');
      try {
        await podcastHost.getPodcast(castopodPodcastId);
      } catch (err) {
        if (err instanceof CastopodError && err.status === 404) throw errors.badRequest(`Castopod podcast ${castopodPodcastId} does not exist`);
        if (err instanceof CastopodError) throw upstream(err);
        throw err;
      }
    }
    await prisma.show.update({
      where: { id },
      data: {
        podcastEnabled: body.podcastEnabled,
        podcastAuthor: body.podcastAuthor ?? null,
        podcastCategory: body.podcastCategory ?? null,
        podcastSubcategory: body.podcastSubcategory ?? null,
        podcastExplicit: body.podcastExplicit,
        podcastLanguage: body.podcastLanguage,
        castopodPodcastId,
      },
    });
    await audit(req, 'settings.update', 'show', id, { podcastEnabled: body.podcastEnabled, castopodPodcastId });
    res.json(await loadShow(id));
  });

  router.get('/shows/:id/episodes', read, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    if (!(await prisma.show.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('Show not found');
    const rows = await prisma.episode.findMany({ where: { showId: id }, select: episodeSelect, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'first' } }, { title: 'asc' }], take: 500 });
    res.json({ items: rows.map(toEpisode) });
  });

  router.put('/episodes/:id/type', publish, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const { episodeType } = validate(podcastEpisodeTypeInputSchema, req.body, 'body');
    if (!(await prisma.episode.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('Episode not found');
    const row = await prisma.episode.update({ where: { id }, data: { episodeType }, select: episodeSelect });
    await audit(req, 'episode_type.update', 'episode', id, { episodeType });
    res.json(toEpisode(row));
  });

  /** Queues sending a published episode's MP3 to Castopod. Castopod cannot update episodes, so this runs once per episode. */
  router.post('/episodes/:id/castopod', publish, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    if (!podcastHost) throw unavailable('Castopod');
    if (!media.queue) throw unavailable('The media processing queue');
    const episode = await prisma.episode.findUnique({ where: { id }, select: { ...episodeSelect, show: { select: { status: true, castopodPodcastId: true } } } });
    if (!episode) throw errors.notFound('Episode not found');
    if (episode.castopodEpisodeId !== null) throw errors.conflict('This episode is already on Castopod; edit it there');
    if (episode.status !== 'published' || episode.show.status !== 'published') throw errors.conflict('Publish the episode and its show first');
    if (episode.show.castopodPodcastId === null) throw errors.conflict('Link the show to a Castopod podcast first');
    if (!hasAudio(episode)) throw errors.conflict('The episode has no processed audio yet');
    const claimed = await prisma.episode.updateMany({
      where: { id, castopodEpisodeId: null, OR: [{ podcastSyncStatus: null }, { podcastSyncStatus: 'failed' }] },
      data: { podcastSyncStatus: 'queued', podcastSyncError: null },
    });
    if (claimed.count === 0) throw errors.conflict('A Castopod sync is already in progress');
    await media.queue.enqueue({ type: 'podcast-sync', episodeId: id }, Date.now());
    await audit(req, 'castopod.queue', 'episode', id, { castopodPodcastId: episode.show.castopodPodcastId });
    res.status(202).json(toEpisode(await prisma.episode.findUniqueOrThrow({ where: { id }, select: episodeSelect })));
  });

  router.get('/castopod/podcasts', publish, async (_req, res) => {
    if (!podcastHost) throw unavailable('Castopod');
    try {
      const items: CastopodPodcastOption[] = (await podcastHost.getPodcasts()).map((p) => ({ id: p.id, handle: p.handle, title: p.title, feedUrl: p.feedUrl }));
      res.json({ items });
    } catch (err) {
      if (err instanceof CastopodError) throw upstream(err);
      throw err;
    }
  });

  return router;
}
