import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@stocktank/database';
import { assetRenditionsSchema } from '@stocktank/media';
import { buildPodcastFeed, type FeedEpisode } from '@stocktank/podcast';
import type { ApiEnv } from '../env.js';
import { PUBLISHED } from '../lib/content.js';
import { errors } from '../lib/errors.js';
import type { MediaService } from '../lib/media.js';
import { validate } from '../lib/validate.js';

export interface PodcastFeedDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  media: MediaService;
}

export const podcastFeedPath = (slug: string) => `/podcasts/${slug}/feed.xml`;

/** Public podcast feed URL on the site origin (the edge and the Vite dev proxy route it to the API). */
export function podcastFeedUrl(env: Pick<ApiEnv, 'PUBLIC_WEB_URL'>, slug: string): string {
  return `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}${podcastFeedPath(slug)}`;
}

/**
 * Podcast RSS for published shows with the feed enabled (§11). Items are published episodes whose media has
 * processed audio; episodes without playable audio are left out rather than published with a broken enclosure.
 */
export function podcastFeedRouter({ env, prisma, media }: PodcastFeedDeps): Router {
  const router = Router();
  const site = env.PUBLIC_WEB_URL.replace(/\/$/, '');

  router.get('/podcasts/:slug/feed.xml', async (req, res) => {
    const { slug } = validate(z.object({ slug: z.string().min(1).max(160) }), req.params, 'params');
    const show = await prisma.show.findFirst({ where: { slug, status: PUBLISHED, podcastEnabled: true } });
    if (!show) throw errors.notFound('Podcast feed not found');

    const rows = await prisma.episode.findMany({
      where: { showId: show.id, status: PUBLISHED, publishedAt: { lte: new Date() }, mediaAsset: { status: 'ready' } },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        description: true,
        number: true,
        episodeType: true,
        publishedAt: true,
        durationSeconds: true,
        coverUrl: true,
        isDemo: true,
        mediaAsset: { select: { renditions: true, durationSeconds: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    });

    const episodes: FeedEpisode[] = [];
    for (const row of rows) {
      const parsed = assetRenditionsSchema.safeParse(row.mediaAsset?.renditions);
      const audioKey = parsed.success ? parsed.data.audio : null;
      const audioUrl = media.publicUrl(audioKey);
      if (!audioKey || !audioUrl || !row.publishedAt) continue;
      // Assets processed before sizes were recorded: ask storage once rather than publishing length="0".
      let audioBytes = parsed.success ? parsed.data.audioBytes : undefined;
      if (audioBytes === undefined && media.storage) audioBytes = (await media.storage.head(audioKey).catch(() => null))?.size;
      episodes.push({
        id: row.id,
        title: row.title,
        summary: row.summary,
        description: row.description,
        link: `${site}/shows/${show.slug}/${row.slug}`,
        publishedAt: row.publishedAt,
        durationSeconds: row.mediaAsset?.durationSeconds ?? row.durationSeconds,
        number: row.number,
        type: row.episodeType,
        audioUrl,
        audioBytes: audioBytes ?? 0,
        imageUrl: row.coverUrl,
        isDemo: row.isDemo,
      });
    }

    const xml = buildPodcastFeed(
      {
        slug: show.slug,
        title: show.title,
        description: show.description ?? show.tagline,
        author: show.podcastAuthor,
        coverUrl: show.coverUrl,
        language: show.podcastLanguage,
        category: show.podcastCategory,
        subcategory: show.podcastSubcategory,
        explicit: show.podcastExplicit,
        isDemo: show.isDemo,
        link: `${site}/shows/${show.slug}`,
        feedUrl: podcastFeedUrl(env, show.slug),
        ownerName: env.PODCAST_OWNER_NAME,
        ownerEmail: env.PODCAST_OWNER_EMAIL ?? null,
        copyright: `© ${new Date().getUTCFullYear()} ${env.PODCAST_OWNER_NAME}`,
      },
      episodes,
    );
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=1200');
    res.send(xml);
  });

  return router;
}
