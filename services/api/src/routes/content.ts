import { Router, type Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@stocktank/database';
import {
  listQuerySchema,
  searchQuerySchema,
  type CompanyListResponse,
  type HomeResponse,
  type ProjectListResponse,
  type PublicFlagsResponse,
  type SearchResponse,
  type ShowDetailResponse,
  type ShowListResponse,
} from '@stocktank/types';
import {
  PUBLISHED,
  articleSelect,
  clipSelect,
  companySelect,
  episodeSelect,
  livestreamSelect,
  projectSelect,
  showSelect,
  toArticleSummary,
  toClipSummary,
  toCompanySummary,
  toEpisodeSummary,
  toLivestreamSummary,
  toProjectSummary,
  toShowSummary,
} from '../lib/content.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export interface ContentDeps {
  prisma: PrismaClient;
}

export const slugParamsSchema = z.object({ slug: z.string().min(1).max(160) });

/** Public, non-personalised responses may be cached briefly by browsers and the CDN (§45). */
function publicCache(res: Response, seconds: number): void {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`);
}

export function contentRouter({ prisma }: ContentDeps): Router {
  const router = Router();

  router.get('/home', async (_req, res) => {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [featuredShows, latestEpisodes, clips, explainers, projects, companies, live, rundown] = await Promise.all([
      prisma.show.findMany({ where: { status: PUBLISHED }, select: showSelect, orderBy: { createdAt: 'asc' }, take: 5 }),
      prisma.episode.findMany({
        where: { status: PUBLISHED, show: { status: PUBLISHED } },
        select: episodeSelect,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: 8,
      }),
      prisma.clip.findMany({
        where: { reviewStatus: PUBLISHED, sourceEpisode: { status: PUBLISHED } },
        select: clipSelect,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.article.findMany({
        where: { status: PUBLISHED },
        select: articleSelect,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: 8,
      }),
      prisma.project.findMany({ where: { status: PUBLISHED }, select: projectSelect, orderBy: { name: 'asc' }, take: 8 }),
      prisma.company.findMany({ where: { status: PUBLISHED }, select: companySelect, orderBy: { name: 'asc' }, take: 8 }),
      prisma.livestream.findFirst({ where: { status: 'live' }, select: livestreamSelect, orderBy: { scheduledStart: 'desc' } }),
      prisma.livestream.findMany({
        where: {
          OR: [{ status: 'live' }, { status: 'scheduled', scheduledStart: { gte: startOfToday } }],
        },
        select: livestreamSelect,
        orderBy: { scheduledStart: 'asc' },
        take: 6,
      }),
    ]);

    const response: HomeResponse = {
      featuredShows: featuredShows.map(toShowSummary),
      latestEpisodes: latestEpisodes.map(toEpisodeSummary),
      clips: clips.map(toClipSummary),
      explainers: explainers.map(toArticleSummary),
      projects: projects.map(toProjectSummary),
      companies: companies.map(toCompanySummary),
      live: live ? toLivestreamSummary(live) : null,
      rundown: rundown.map(toLivestreamSummary),
      generatedAt: new Date().toISOString(),
    };
    publicCache(res, 30);
    res.json(response);
  });

  router.get('/shows', async (req, res) => {
    const { page, pageSize } = validate(listQuerySchema, req.query, 'query');
    const where = { status: PUBLISHED };
    const [rows, total] = await Promise.all([
      prisma.show.findMany({ where, select: showSelect, orderBy: { title: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.show.count({ where }),
    ]);
    const response: ShowListResponse = { items: rows.map(toShowSummary), page, pageSize, total };
    publicCache(res, 60);
    res.json(response);
  });

  router.get('/shows/:slug', async (req, res) => {
    const { slug } = validate(slugParamsSchema, req.params, 'params');
    const show = await prisma.show.findFirst({ where: { slug, status: PUBLISHED }, select: showSelect });
    if (!show) throw errors.notFound('Show not found');
    const episodes = await prisma.episode.findMany({
      where: { show: { slug }, status: PUBLISHED },
      select: episodeSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: 50,
    });
    const response: ShowDetailResponse = { show: toShowSummary(show), episodes: episodes.map(toEpisodeSummary) };
    publicCache(res, 60);
    res.json(response);
  });

  router.get('/projects', async (req, res) => {
    const { page, pageSize } = validate(listQuerySchema, req.query, 'query');
    const where = { status: PUBLISHED };
    const [rows, total] = await Promise.all([
      prisma.project.findMany({ where, select: projectSelect, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.project.count({ where }),
    ]);
    const response: ProjectListResponse = { items: rows.map(toProjectSummary), page, pageSize, total };
    publicCache(res, 60);
    res.json(response);
  });

  router.get('/companies', async (req, res) => {
    const { page, pageSize } = validate(listQuerySchema, req.query, 'query');
    const where = { status: PUBLISHED };
    const [rows, total] = await Promise.all([
      prisma.company.findMany({ where, select: companySelect, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.company.count({ where }),
    ]);
    const response: CompanyListResponse = { items: rows.map(toCompanySummary), page, pageSize, total };
    publicCache(res, 60);
    res.json(response);
  });

  /** Grouped search over published content. Postgres ILIKE until Meilisearch (Milestone 2). */
  router.get('/search', async (req, res) => {
    const { q } = validate(searchQuerySchema, req.query, 'query');
    const contains = { contains: q, mode: 'insensitive' as const };
    const [shows, episodes, projects, companies] = await Promise.all([
      prisma.show.findMany({
        where: { status: PUBLISHED, OR: [{ title: contains }, { tagline: contains }] },
        select: showSelect,
        take: 5,
      }),
      prisma.episode.findMany({
        where: { status: PUBLISHED, show: { status: PUBLISHED }, OR: [{ title: contains }, { summary: contains }] },
        select: episodeSelect,
        orderBy: { publishedAt: 'desc' },
        take: 5,
      }),
      prisma.project.findMany({
        where: { status: PUBLISHED, OR: [{ name: contains }, { symbol: contains }] },
        select: projectSelect,
        take: 5,
      }),
      prisma.company.findMany({
        where: { status: PUBLISHED, OR: [{ name: contains }, { ticker: contains }, { sector: contains }] },
        select: companySelect,
        take: 5,
      }),
    ]);
    const response: SearchResponse = {
      query: q,
      shows: shows.map(toShowSummary),
      episodes: episodes.map(toEpisodeSummary),
      projects: projects.map(toProjectSummary),
      companies: companies.map(toCompanySummary),
    };
    res.json(response);
  });

  /** Feature flags are not secret; front-ends hide unfinished features with them (§50). */
  router.get('/flags', async (_req, res) => {
    const flags = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } });
    const response: PublicFlagsResponse = { flags: Object.fromEntries(flags.map((f) => [f.key, f.enabled])) };
    publicCache(res, 15);
    res.json(response);
  });

  return router;
}
