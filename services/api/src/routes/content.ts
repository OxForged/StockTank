import { Router, type Response } from 'express';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@stocktank/database';
import {
  listQuerySchema,
  searchQuerySchema,
  type CompanyListResponse,
  type HomeResponse,
  type ArticleDetailResponse,
  type ArticleListResponse,
  type CompanyDetailResponse,
  type EpisodeDetailResponse,
  type PersonDetailResponse,
  type ProjectDetailResponse,
  type ProjectListResponse,
  type PublicFlagsResponse,
  type SearchSuggestResponse,
  type TrendingSearchesResponse,
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
import { personSelect, toGuestSummary, toHostSummary } from '../lib/people.js';
import type { SearchService } from '../lib/search.js';
import { validate } from '../lib/validate.js';

export interface ContentDeps {
  prisma: PrismaClient;
  search: SearchService;
}

export const slugParamsSchema = z.object({ slug: z.string().min(1).max(160) });

/** Public, non-personalised responses may be cached briefly by browsers and the CDN (§45). */
function publicCache(res: Response, seconds: number): void {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`);
}

export function contentRouter({ prisma, search }: ContentDeps): Router {
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
    const hosts = await prisma.host.findMany({
      where: { shows: { some: { show: { slug } } } },
      select: { ...personSelect, isAi: true },
      orderBy: { name: 'asc' },
    });
    const response: ShowDetailResponse = { show: toShowSummary(show), hosts: hosts.map(toHostSummary), episodes: episodes.map(toEpisodeSummary) };
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

  router.get('/articles', async (req, res) => {
    const { page, pageSize } = validate(listQuerySchema, req.query, 'query');
    const where = { status: PUBLISHED };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where, select: articleSelect, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.article.count({ where }),
    ]);
    const response: ArticleListResponse = { items: rows.map(toArticleSummary), page, pageSize, total };
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

  /** Grouped search (§10): Meilisearch when configured, Postgres fallback; always hydrated from published rows. */
  router.get('/search', async (req, res) => {
    const { q } = validate(searchQuerySchema, req.query, 'query');
    res.set('Cache-Control', 'private, no-store');
    res.json(await search.search(q));
  });

  router.get('/search/suggest', async (req, res) => {
    const { q } = validate(searchQuerySchema, req.query, 'query');
    const response: SearchSuggestResponse = { query: q, suggestions: await search.suggest(q) };
    res.set('Cache-Control', 'private, no-store');
    res.json(response);
  });

  router.get('/search/trending', async (_req, res) => {
    const response: TrendingSearchesResponse = { queries: await search.trending() };
    publicCache(res, 300);
    res.json(response);
  });

  // ───── Media graph detail pages (§9) ─────
  router.get('/shows/:slug/episodes/:episodeSlug', async (req, res) => {
    const { slug, episodeSlug } = validate(slugParamsSchema.extend({ episodeSlug: z.string().min(1).max(160) }), req.params, 'params');
    const episode = await prisma.episode.findFirst({
      where: { slug: episodeSlug, status: PUBLISHED, show: { slug, status: PUBLISHED } },
      select: {
        ...episodeSelect,
        description: true,
        number: true,
        showId: true,
        hosts: { select: { host: { select: { ...personSelect, isAi: true } } } },
        guests: { select: { guest: { select: { ...personSelect, title: true } } } },
        projects: { where: { project: { status: PUBLISHED } }, select: { project: { select: projectSelect } } },
        companies: { where: { company: { status: PUBLISHED } }, select: { company: { select: companySelect } } },
        clips: { where: { reviewStatus: PUBLISHED }, select: clipSelect, orderBy: { startTime: 'asc' } },
      },
    });
    if (!episode) throw errors.notFound('Episode not found');
    const more = await prisma.episode.findMany({
      where: { showId: episode.showId, status: PUBLISHED, id: { not: episode.id } },
      select: episodeSelect,
      orderBy: { publishedAt: 'desc' },
      take: 4,
    });
    const response: EpisodeDetailResponse = {
      episode: { ...toEpisodeSummary(episode), description: episode.description, number: episode.number },
      hosts: episode.hosts.map((h) => toHostSummary(h.host)),
      guests: episode.guests.map((g) => toGuestSummary(g.guest)),
      projects: episode.projects.map((p) => toProjectSummary(p.project)),
      companies: episode.companies.map((c) => toCompanySummary(c.company)),
      clips: episode.clips.map(toClipSummary),
      moreFromShow: more.map(toEpisodeSummary),
    };
    publicCache(res, 60);
    res.json(response);
  });

  const episodesMentioning = (where: Prisma.EpisodeWhereInput) =>
    prisma.episode.findMany({
      where: { ...where, status: PUBLISHED, show: { status: PUBLISHED } },
      select: episodeSelect,
      orderBy: { publishedAt: 'desc' },
      take: 24,
    });

  router.get('/projects/:slug', async (req, res) => {
    const { slug } = validate(slugParamsSchema, req.params, 'params');
    const project = await prisma.project.findFirst({
      where: { slug, status: PUBLISHED },
      select: { ...projectSelect, website: true, twitter: true, contractAddress: true, chain: { select: { name: true, explorer: true } } },
    });
    if (!project) throw errors.notFound('Project not found');
    const explorer = project.chain?.explorer;
    const response: ProjectDetailResponse = {
      project: {
        ...toProjectSummary(project),
        website: project.website,
        twitter: project.twitter,
        contractAddress: project.contractAddress,
        explorerUrl:
          explorer && project.contractAddress ? `${explorer.replace(/\/$/, '')}/address/${encodeURIComponent(project.contractAddress)}` : null,
      },
      episodes: (await episodesMentioning({ projects: { some: { projectId: project.id } } })).map(toEpisodeSummary),
    };
    publicCache(res, 60);
    res.json(response);
  });

  router.get('/companies/:slug', async (req, res) => {
    const { slug } = validate(slugParamsSchema, req.params, 'params');
    const company = await prisma.company.findFirst({ where: { slug, status: PUBLISHED }, select: { ...companySelect, industry: true, website: true } });
    if (!company) throw errors.notFound('Company not found');
    const { industry, website, ...summary } = company;
    const response: CompanyDetailResponse = {
      company: { ...toCompanySummary(summary), industry, website },
      episodes: (await episodesMentioning({ companies: { some: { companyId: company.id } } })).map(toEpisodeSummary),
    };
    publicCache(res, 60);
    res.json(response);
  });

  /** Hosts and guests share /people/:slug; a host wins if both use the same slug. */
  router.get('/people/:slug', async (req, res) => {
    const { slug } = validate(slugParamsSchema, req.params, 'params');
    const host = await prisma.host.findUnique({ where: { slug }, select: { ...personSelect, isAi: true } });
    const guest = host ? null : await prisma.guest.findUnique({ where: { slug }, select: { ...personSelect, title: true, website: true } });
    if (!host && !guest) throw errors.notFound('Person not found');
    const episodes = host
      ? await episodesMentioning({ OR: [{ hosts: { some: { hostId: host.id } } }, { show: { hosts: { some: { hostId: host.id } } } }] })
      : await episodesMentioning({ guests: { some: { guestId: guest!.id } } });
    const response: PersonDetailResponse = {
      person: host ? { ...toHostSummary(host), website: null } : { ...toGuestSummary(guest!), website: guest!.website },
      episodes: episodes.map(toEpisodeSummary),
    };
    publicCache(res, 60);
    res.json(response);
  });

  router.get('/articles/:slug', async (req, res) => {
    const { slug } = validate(slugParamsSchema, req.params, 'params');
    const article = await prisma.article.findFirst({
      where: { slug, status: PUBLISHED },
      select: { ...articleSelect, body: true, author: true, originalUrl: true },
    });
    if (!article) throw errors.notFound('Article not found');
    const response: ArticleDetailResponse = {
      article: { ...toArticleSummary(article), body: article.body, author: article.author, originalUrl: article.originalUrl },
    };
    publicCache(res, 60);
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
