import { Router } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@stocktank/database';
import { bookmarkRequestSchema, followRequestSchema, type LibraryResponse } from '@stocktank/types';
import {
  PUBLISHED,
  companySelect,
  episodeSelect,
  projectSelect,
  showSelect,
  toCompanySummary,
  toEpisodeSummary,
  toProjectSummary,
  toShowSummary,
} from '../lib/content.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { getAuth, requireAuth } from '../middleware/auth.js';

export interface MeDeps {
  prisma: PrismaClient;
}

const episodeParams = z.object({ episodeId: z.string().min(1).max(64) });

/** The signed-in viewer's follows, bookmarks and library (README §30). No wallet required. */
export function meRouter({ prisma }: MeDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/library', async (req, res) => {
    const userId = getAuth(req).user.id;
    const [follows, bookmarks] = await Promise.all([
      prisma.follow.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          show: { select: { ...showSelect, status: true } },
          project: { select: { ...projectSelect, status: true } },
          company: { select: { ...companySelect, status: true } },
        },
      }),
      prisma.bookmark.findMany({
        where: { userId, episode: { status: PUBLISHED } },
        orderBy: { createdAt: 'desc' },
        select: { positionSeconds: true, createdAt: true, episode: { select: episodeSelect } },
      }),
    ]);
    // Items that were unpublished after being followed stay followed but are not shown.
    const response: LibraryResponse = {
      shows: follows.flatMap((f) => (f.show?.status === PUBLISHED ? [toShowSummary(f.show)] : [])),
      projects: follows.flatMap((f) => (f.project?.status === PUBLISHED ? [toProjectSummary(f.project)] : [])),
      companies: follows.flatMap((f) => (f.company?.status === PUBLISHED ? [toCompanySummary(f.company)] : [])),
      bookmarks: bookmarks.map((b) => ({
        ...toEpisodeSummary(b.episode),
        positionSeconds: b.positionSeconds,
        bookmarkedAt: b.createdAt.toISOString(),
      })),
    };
    res.set('Cache-Control', 'private, no-store');
    res.json(response);
  });

  router.post('/follows', async (req, res) => {
    const { target, id } = validate(followRequestSchema, req.body, 'body');
    const userId = getAuth(req).user.id;
    const exists =
      target === 'show'
        ? await prisma.show.count({ where: { id, status: PUBLISHED } })
        : target === 'project'
          ? await prisma.project.count({ where: { id, status: PUBLISHED } })
          : await prisma.company.count({ where: { id, status: PUBLISHED } });
    if (!exists) throw errors.notFound(`${target} not found`);
    const column = target === 'show' ? 'showId' : target === 'project' ? 'projectId' : 'companyId';
    try {
      await prisma.follow.create({ data: { userId, [column]: id } });
    } catch (err) {
      // Already following: the request is idempotent.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    res.status(204).end();
  });

  router.delete('/follows', async (req, res) => {
    const { target, id } = validate(followRequestSchema, req.body, 'body');
    const column = target === 'show' ? 'showId' : target === 'project' ? 'projectId' : 'companyId';
    await prisma.follow.deleteMany({ where: { userId: getAuth(req).user.id, [column]: id } });
    res.status(204).end();
  });

  router.put('/bookmarks', async (req, res) => {
    const { episodeId, positionSeconds } = validate(bookmarkRequestSchema, req.body, 'body');
    const userId = getAuth(req).user.id;
    const episode = await prisma.episode.count({ where: { id: episodeId, status: PUBLISHED } });
    if (!episode) throw errors.notFound('Episode not found');
    await prisma.bookmark.upsert({
      where: { userId_episodeId: { userId, episodeId } },
      create: { userId, episodeId, positionSeconds },
      update: { positionSeconds },
    });
    res.status(204).end();
  });

  router.delete('/bookmarks/:episodeId', async (req, res) => {
    const { episodeId } = validate(episodeParams, req.params, 'params');
    await prisma.bookmark.deleteMany({ where: { userId: getAuth(req).user.id, episodeId } });
    res.status(204).end();
  });

  return router;
}
