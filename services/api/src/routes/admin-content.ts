import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@stocktank/database';
import {
  PUBLISH_ONLY_STATUSES,
  adminContentListQuerySchema,
  articleInputSchema,
  companyInputSchema,
  episodeInputSchema,
  livestreamInputSchema,
  projectInputSchema,
  showInputSchema,
  type AdminArticle,
  type AdminCompany,
  type AdminEpisode,
  type AdminList,
  type AdminLivestream,
  type AdminProject,
  type AdminShow,
  type ChainOption,
  type PublishStatus,
} from '@stocktank/types';
import { writeAudit } from '../lib/audit.js';
import {
  articleSelect,
  companySelect,
  episodeSelect,
  livestreamSelect,
  projectSelect,
  toArticleSummary,
  toCompanySummary,
  toEpisodeSummary,
  toLivestreamSummary,
  toProjectSummary,
} from '../lib/content.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';

export interface AdminContentDeps {
  prisma: PrismaClient;
}

const idParams = z.object({ id: z.string().min(1).max(64) });

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'item'
  );
}

/** Publishing, archiving or rejecting requires `content.publish`; writers can only draft and submit for review. */
function assertCanSetStatus(req: Request, status: PublishStatus): void {
  if (PUBLISH_ONLY_STATUSES.has(status) && !getAuth(req).permissions.includes('content.publish')) {
    throw errors.forbidden(`Setting status "${status}" requires the content.publish permission`);
  }
}

function conflictOnUnique(err: unknown, what: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw errors.conflict(`A ${what} with this slug already exists`);
  }
  throw err;
}

const nullIfUndefined = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

export function adminContentRouter({ prisma }: AdminContentDeps): Router {
  const router = Router();
  const read = requirePermission('content.read_drafts');
  const write = requirePermission('content.write');
  const entities = requirePermission('entities.write');

  const audit = (req: Request, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonObject) =>
    writeAudit(prisma, req, { action: `content.${action}` as const, actorId: getAuth(req).user.id, targetType, targetId, ...(metadata ? { metadata } : {}) });

  // ───── Shows ─────
  const adminShowSelect = {
    id: true,
    slug: true,
    title: true,
    tagline: true,
    description: true,
    coverUrl: true,
    isDemo: true,
    status: true,
    updatedAt: true,
    _count: { select: { episodes: true } },
  } satisfies Prisma.ShowSelect;
  const toAdminShow = (r: Prisma.ShowGetPayload<{ select: typeof adminShowSelect }>): AdminShow => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    description: r.description,
    coverUrl: r.coverUrl,
    episodeCount: r._count.episodes,
    isDemo: r.isDemo,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  });

  router.get('/shows', read, async (req, res) => {
    const q = validate(adminContentListQuerySchema, req.query, 'query');
    const where: Prisma.ShowWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.show.findMany({ where, select: adminShowSelect, orderBy: { title: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.show.count({ where }),
    ]);
    const response: AdminList<AdminShow> = { items: rows.map(toAdminShow), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  const saveShow = async (req: Request, id: string | null) => {
    const body = validate(showInputSchema, req.body, 'body');
    assertCanSetStatus(req, body.status);
    const data = {
      title: body.title,
      slug: body.slug ?? slugify(body.title),
      tagline: nullIfUndefined(body.tagline),
      description: nullIfUndefined(body.description),
      coverUrl: nullIfUndefined(body.coverUrl),
      status: body.status,
    };
    try {
      const row = id
        ? await prisma.show.update({ where: { id }, data, select: adminShowSelect })
        : await prisma.show.create({ data, select: adminShowSelect });
      await audit(req, id ? 'show.update' : 'show.create', 'show', row.id, { status: row.status });
      return toAdminShow(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw errors.notFound('Show not found');
      return conflictOnUnique(err, 'show');
    }
  };
  router.post('/shows', write, async (req, res) => res.status(201).json(await saveShow(req, null)));
  router.put('/shows/:id', write, async (req, res) => res.json(await saveShow(req, validate(idParams, req.params, 'params').id)));

  // ───── Episodes ─────
  const adminEpisodeSelect = {
    ...episodeSelect,
    status: true,
    updatedAt: true,
    showId: true,
    number: true,
    description: true,
    projects: { select: { projectId: true } },
    companies: { select: { companyId: true } },
  } satisfies Prisma.EpisodeSelect;
  const toAdminEpisode = (r: Prisma.EpisodeGetPayload<{ select: typeof adminEpisodeSelect }>): AdminEpisode => ({
    ...toEpisodeSummary(r),
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    showId: r.showId,
    number: r.number,
    description: r.description,
    projectIds: r.projects.map((p) => p.projectId),
    companyIds: r.companies.map((c) => c.companyId),
  });

  router.get('/episodes', read, async (req, res) => {
    const q = validate(adminContentListQuerySchema.extend({ showId: z.string().optional() }), req.query, 'query');
    const where: Prisma.EpisodeWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.showId ? { showId: q.showId } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.episode.findMany({
        where,
        select: adminEpisodeSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.episode.count({ where }),
    ]);
    const response: AdminList<AdminEpisode> = { items: rows.map(toAdminEpisode), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  const saveEpisode = async (req: Request, id: string | null) => {
    const body = validate(episodeInputSchema, req.body, 'body');
    assertCanSetStatus(req, body.status);
    const show = await prisma.show.findUnique({ where: { id: body.showId }, select: { id: true } });
    if (!show) throw errors.badRequest('Show not found');
    const [projects, companies] = await Promise.all([
      prisma.project.count({ where: { id: { in: body.projectIds } } }),
      prisma.company.count({ where: { id: { in: body.companyIds } } }),
    ]);
    if (projects !== new Set(body.projectIds).size || companies !== new Set(body.companyIds).size) {
      throw errors.badRequest('One or more linked projects or companies do not exist');
    }
    const publishedAt =
      body.publishedAt !== undefined && body.publishedAt !== null
        ? new Date(body.publishedAt)
        : body.status === 'published'
          ? new Date()
          : null;
    const data = {
      showId: body.showId,
      title: body.title,
      slug: body.slug ?? slugify(body.title),
      number: nullIfUndefined(body.number),
      summary: nullIfUndefined(body.summary),
      description: nullIfUndefined(body.description),
      coverUrl: nullIfUndefined(body.coverUrl),
      durationSeconds: nullIfUndefined(body.durationSeconds),
      status: body.status,
      publishedAt,
    };
    try {
      const row = await prisma.$transaction(async (tx) => {
        if (id) {
          const existing = await tx.episode.findUnique({ where: { id }, select: { publishedAt: true } });
          if (!existing) throw errors.notFound('Episode not found');
          // Keep the original publication time when re-saving a published episode without a new date.
          if (body.publishedAt === undefined && existing.publishedAt) data.publishedAt = existing.publishedAt;
          await tx.episodeProject.deleteMany({ where: { episodeId: id } });
          await tx.episodeCompany.deleteMany({ where: { episodeId: id } });
        }
        const links = {
          projects: { create: [...new Set(body.projectIds)].map((projectId) => ({ projectId })) },
          companies: { create: [...new Set(body.companyIds)].map((companyId) => ({ companyId })) },
        };
        return id
          ? tx.episode.update({ where: { id }, data: { ...data, ...links }, select: adminEpisodeSelect })
          : tx.episode.create({ data: { ...data, ...links }, select: adminEpisodeSelect });
      });
      await audit(req, id ? 'episode.update' : 'episode.create', 'episode', row.id, { status: row.status });
      return toAdminEpisode(row);
    } catch (err) {
      return conflictOnUnique(err, 'episode in this show');
    }
  };
  router.post('/episodes', write, async (req, res) => res.status(201).json(await saveEpisode(req, null)));
  router.put('/episodes/:id', write, async (req, res) => res.json(await saveEpisode(req, validate(idParams, req.params, 'params').id)));

  // ───── Projects ─────
  const adminProjectSelect = {
    ...projectSelect,
    status: true,
    updatedAt: true,
    website: true,
    twitter: true,
    contractAddress: true,
    chain: { select: { name: true, slug: true } },
  } satisfies Prisma.ProjectSelect;
  const toAdminProject = (r: Prisma.ProjectGetPayload<{ select: typeof adminProjectSelect }>): AdminProject => ({
    ...toProjectSummary(r),
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    website: r.website,
    twitter: r.twitter,
    chainSlug: r.chain?.slug ?? null,
    contractAddress: r.contractAddress,
  });

  router.get('/chains', read, async (_req, res) => {
    const rows = await prisma.chain.findMany({ select: { slug: true, name: true }, orderBy: { name: 'asc' } });
    const items: ChainOption[] = rows;
    res.json({ items });
  });

  router.get('/projects', read, async (req, res) => {
    const q = validate(adminContentListQuerySchema, req.query, 'query');
    const where: Prisma.ProjectWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.project.findMany({ where, select: adminProjectSelect, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.project.count({ where }),
    ]);
    const response: AdminList<AdminProject> = { items: rows.map(toAdminProject), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  const saveProject = async (req: Request, id: string | null) => {
    const body = validate(projectInputSchema, req.body, 'body');
    assertCanSetStatus(req, body.status);
    let chainId: string | null = null;
    if (body.chainSlug) {
      const chain = await prisma.chain.findUnique({ where: { slug: body.chainSlug }, select: { id: true } });
      if (!chain) throw errors.badRequest('Unknown chain');
      chainId = chain.id;
    }
    const data = {
      name: body.name,
      slug: body.slug ?? slugify(body.name),
      symbol: nullIfUndefined(body.symbol),
      kind: body.kind,
      description: nullIfUndefined(body.description),
      logoUrl: nullIfUndefined(body.logoUrl),
      website: nullIfUndefined(body.website),
      twitter: nullIfUndefined(body.twitter),
      chainId,
      contractAddress: nullIfUndefined(body.contractAddress),
      verified: body.verified,
      status: body.status,
    };
    try {
      const row = id
        ? await prisma.project.update({ where: { id }, data, select: adminProjectSelect })
        : await prisma.project.create({ data, select: adminProjectSelect });
      await audit(req, id ? 'project.update' : 'project.create', 'project', row.id, { status: row.status });
      return toAdminProject(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw errors.notFound('Project not found');
      return conflictOnUnique(err, 'project');
    }
  };
  router.post('/projects', entities, async (req, res) => res.status(201).json(await saveProject(req, null)));
  router.put('/projects/:id', entities, async (req, res) => res.json(await saveProject(req, validate(idParams, req.params, 'params').id)));

  // ───── Companies ─────
  const adminCompanySelect = { ...companySelect, status: true, updatedAt: true, industry: true, website: true } satisfies Prisma.CompanySelect;
  const toAdminCompany = (r: Prisma.CompanyGetPayload<{ select: typeof adminCompanySelect }>): AdminCompany => ({
    ...toCompanySummary(r),
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    industry: r.industry,
    website: r.website,
  });

  router.get('/companies', read, async (req, res) => {
    const q = validate(adminContentListQuerySchema, req.query, 'query');
    const where: Prisma.CompanyWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { ticker: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.company.findMany({ where, select: adminCompanySelect, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.company.count({ where }),
    ]);
    const response: AdminList<AdminCompany> = {
      items: rows.map((r) => toAdminCompany(r)),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
    res.json(response);
  });

  const saveCompany = async (req: Request, id: string | null) => {
    const body = validate(companyInputSchema, req.body, 'body');
    assertCanSetStatus(req, body.status);
    const data = {
      name: body.name,
      slug: body.slug ?? slugify(body.name),
      ticker: body.ticker ? body.ticker.toUpperCase() : null,
      exchange: body.exchange ? body.exchange.toUpperCase() : null,
      sector: nullIfUndefined(body.sector),
      industry: nullIfUndefined(body.industry),
      country: nullIfUndefined(body.country),
      description: nullIfUndefined(body.description),
      logoUrl: nullIfUndefined(body.logoUrl),
      website: nullIfUndefined(body.website),
      status: body.status,
    };
    try {
      const row = id
        ? await prisma.company.update({ where: { id }, data, select: adminCompanySelect })
        : await prisma.company.create({ data, select: adminCompanySelect });
      await audit(req, id ? 'company.update' : 'company.create', 'company', row.id, { status: row.status });
      return toAdminCompany(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw errors.notFound('Company not found');
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw errors.conflict('A company with this slug or exchange/ticker already exists');
      }
      throw err;
    }
  };
  router.post('/companies', entities, async (req, res) => res.status(201).json(await saveCompany(req, null)));
  router.put('/companies/:id', entities, async (req, res) => res.json(await saveCompany(req, validate(idParams, req.params, 'params').id)));

  // ───── Articles ─────
  const adminArticleSelect = { ...articleSelect, status: true, updatedAt: true, body: true, author: true, originalUrl: true } satisfies Prisma.ArticleSelect;
  const toAdminArticle = (r: Prisma.ArticleGetPayload<{ select: typeof adminArticleSelect }>): AdminArticle => ({
    ...toArticleSummary(r),
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    body: r.body,
    author: r.author,
    originalUrl: r.originalUrl,
  });

  router.get('/articles', read, async (req, res) => {
    const q = validate(adminContentListQuerySchema, req.query, 'query');
    const where: Prisma.ArticleWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where, select: adminArticleSelect, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.article.count({ where }),
    ]);
    const response: AdminList<AdminArticle> = { items: rows.map(toAdminArticle), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  const saveArticle = async (req: Request, id: string | null) => {
    const body = validate(articleInputSchema, req.body, 'body');
    assertCanSetStatus(req, body.status);
    const data = {
      title: body.title,
      slug: body.slug ?? slugify(body.title),
      summary: nullIfUndefined(body.summary),
      body: nullIfUndefined(body.body),
      author: nullIfUndefined(body.author),
      originalUrl: nullIfUndefined(body.originalUrl),
      status: body.status,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : body.status === 'published' ? new Date() : null,
    };
    try {
      if (id && body.publishedAt === undefined) {
        const existing = await prisma.article.findUnique({ where: { id }, select: { publishedAt: true } });
        if (!existing) throw errors.notFound('Article not found');
        if (existing.publishedAt) data.publishedAt = existing.publishedAt;
      }
      const row = id
        ? await prisma.article.update({ where: { id }, data, select: adminArticleSelect })
        : await prisma.article.create({ data, select: adminArticleSelect });
      await audit(req, id ? 'article.update' : 'article.create', 'article', row.id, { status: row.status });
      return toAdminArticle(row);
    } catch (err) {
      return conflictOnUnique(err, 'article');
    }
  };
  router.post('/articles', write, async (req, res) => res.status(201).json(await saveArticle(req, null)));
  router.put('/articles/:id', write, async (req, res) => res.json(await saveArticle(req, validate(idParams, req.params, 'params').id)));

  // ───── Live schedule ─────
  const adminLivestreamSelect = { ...livestreamSelect, showId: true, updatedAt: true } satisfies Prisma.LivestreamSelect;
  const toAdminLivestream = (r: Prisma.LivestreamGetPayload<{ select: typeof adminLivestreamSelect }>): AdminLivestream => ({
    ...toLivestreamSummary(r),
    showId: r.showId,
    updatedAt: r.updatedAt.toISOString(),
  });
  const publish = requirePermission('content.publish');

  router.get('/livestreams', read, async (req, res) => {
    const q = validate(adminContentListQuerySchema.omit({ status: true }), req.query, 'query');
    const [rows, total] = await Promise.all([
      prisma.livestream.findMany({ select: adminLivestreamSelect, orderBy: { scheduledStart: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.livestream.count(),
    ]);
    const response: AdminList<AdminLivestream> = { items: rows.map(toAdminLivestream), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  /** Scheduling and going on air are publishing decisions (`content.publish`). */
  const saveLivestream = async (req: Request, id: string | null) => {
    const body = validate(livestreamInputSchema, req.body, 'body');
    if (body.showId) {
      const show = await prisma.show.findUnique({ where: { id: body.showId }, select: { id: true } });
      if (!show) throw errors.badRequest('Show not found');
    }
    const now = new Date();
    const data = {
      title: body.title,
      showId: body.showId ?? null,
      description: nullIfUndefined(body.description),
      status: body.status,
      scheduledStart: new Date(body.scheduledStart),
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
      streamUrl: nullIfUndefined(body.streamUrl),
    };
    const row = await prisma.$transaction(async (tx) => {
      let startedAt: Date | null | undefined;
      let endedAt: Date | null | undefined;
      if (id) {
        const existing = await tx.livestream.findUnique({ where: { id }, select: { status: true, startedAt: true, endedAt: true } });
        if (!existing) throw errors.notFound('Broadcast not found');
        startedAt = body.status === 'live' ? (existing.startedAt ?? now) : existing.startedAt;
        endedAt = body.status === 'ended' ? (existing.endedAt ?? now) : existing.endedAt;
        await tx.livestreamSegment.deleteMany({ where: { livestreamId: id } });
      } else {
        startedAt = body.status === 'live' ? now : null;
        endedAt = body.status === 'ended' ? now : null;
      }
      const segments = { create: body.segments.map((title, position) => ({ title, position })) };
      return id
        ? tx.livestream.update({ where: { id }, data: { ...data, startedAt, endedAt, segments }, select: adminLivestreamSelect })
        : tx.livestream.create({ data: { ...data, startedAt, endedAt, segments }, select: adminLivestreamSelect });
    });
    await audit(req, id ? 'livestream.update' : 'livestream.create', 'livestream', row.id, { status: row.status });
    return toAdminLivestream(row);
  };
  router.post('/livestreams', publish, async (req, res) => res.status(201).json(await saveLivestream(req, null)));
  router.put('/livestreams/:id', publish, async (req, res) => res.json(await saveLivestream(req, validate(idParams, req.params, 'params').id)));

  return router;
}
