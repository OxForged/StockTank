import { Router, type Request } from 'express';
import { z } from 'zod';
import { MODERATION_FLAG_LABELS } from '@stocktank/ai';
import type { Prisma, PrismaClient } from '@stocktank/database';
import { assetRenditionsSchema } from '@stocktank/media';
import {
  AI_DRAFT_CONTENT_SCHEMAS,
  AI_DRAFT_KINDS,
  adminAiDraftListQuerySchema,
  aiDraftReviewInputSchema,
  runFactoryInputSchema,
  type AdminAiDraft,
  type AdminAiDraftList,
  type AdminTranscript,
  type AiDraftContent,
  type AiJob,
} from '@stocktank/types';
import { writeAudit } from '../lib/audit.js';
import { AppError, errors } from '../lib/errors.js';
import type { MediaService } from '../lib/media.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';
import { slugify } from './admin-content.js';

export interface AdminAiFactoryDeps {
  prisma: PrismaClient;
  media: MediaService;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const unavailable = () => new AppError('INTERNAL', 'The processing queue is not configured on this server', undefined, 503);

const draftInclude = {
  episode: { select: { id: true, title: true, show: { select: { title: true } } } },
} satisfies Prisma.AiDraftInclude;
type DraftRow = Prisma.AiDraftGetPayload<{ include: typeof draftInclude }>;

/** Content factory + review queue (§20, §27, §56). Reading needs `ai.review`; approving needs `content.publish` too. */
export function adminAiFactoryRouter({ prisma, media }: AdminAiFactoryDeps): Router {
  const router = Router();
  const review = requirePermission('ai.review');
  const publish = requirePermission('ai.review', 'content.publish');

  const audit = (req: Request, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonObject) =>
    writeAudit(prisma, req, { action: `ai.${action}` as const, actorId: getAuth(req).user.id, targetType, targetId, ...(metadata ? { metadata } : {}) });

  const reviewerNames = async (ids: Array<string | null>) => {
    const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
    const users = unique.length ? await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, profile: { select: { displayName: true } } } }) : [];
    return new Map(users.map((u) => [u.id, u.profile?.displayName ?? 'Staff']));
  };

  const toDraft = (r: DraftRow, names: Map<string, string>): AdminAiDraft => {
    const cites = (r.citations as { items?: unknown[]; notes?: string[] } | null) ?? null;
    return {
      id: r.id,
      episodeId: r.episode.id,
      episodeTitle: r.episode.title,
      showTitle: r.episode.show.title,
      kind: r.kind,
      status: r.status,
      content: r.content,
      provider: r.provider,
      model: r.model,
      promptVersion: r.promptVersion,
      citations: z.array(z.object({ start: z.number(), end: z.number(), quote: z.string() })).catch([]).parse(cites?.items ?? []),
      moderationFlags: r.moderationFlags,
      reviewer: r.reviewerId ? { id: r.reviewerId, displayName: names.get(r.reviewerId) ?? 'Staff' } : null,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      appliedAt: r.appliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  };

  const toJob = (j: Prisma.AiJobGetPayload<object>, titles: Map<string, string>): AiJob => ({
    id: j.id,
    type: j.type,
    status: j.status,
    episodeId: j.episodeId,
    episodeTitle: j.episodeId ? (titles.get(j.episodeId) ?? null) : null,
    kinds: j.kinds,
    error: j.error,
    startedAt: j.startedAt?.toISOString() ?? null,
    finishedAt: j.finishedAt?.toISOString() ?? null,
    createdAt: j.createdAt.toISOString(),
  });

  router.get('/moderation-flags', review, (_req, res) => {
    res.json({ items: Object.entries(MODERATION_FLAG_LABELS).map(([key, label]) => ({ key, label })) });
  });

  // ───── Transcripts ─────
  router.get('/episodes/:id/transcript', review, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const t = await prisma.transcript.findUnique({ where: { episodeId: id } });
    if (!t) throw errors.notFound('No transcript for this episode yet');
    const response: AdminTranscript = {
      episodeId: id,
      status: t.status,
      provider: t.provider,
      model: t.model,
      language: t.language,
      text: t.text,
      segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string(), speaker: z.string().nullable(), confidence: z.number().nullable() })).catch([]).parse(t.segments ?? []),
      speakers: t.speakers,
      confidence: t.confidence,
      durationSeconds: t.durationSeconds,
      error: t.error,
      updatedAt: t.updatedAt.toISOString(),
    };
    res.json(response);
  });

  router.post('/episodes/:id/transcribe', review, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    if (!media.queue) throw unavailable();
    const episode = await prisma.episode.findUnique({ where: { id }, select: { id: true, mediaAsset: { select: { status: true, renditions: true } }, transcript: { select: { status: true } } } });
    if (!episode) throw errors.notFound('Episode not found');
    const parsed = episode.mediaAsset?.status === 'ready' ? assetRenditionsSchema.safeParse(episode.mediaAsset.renditions) : null;
    if (!parsed?.success || !parsed.data.audio) throw errors.conflict('The episode has no processed audio yet');
    if (episode.transcript?.status === 'processing' || episode.transcript?.status === 'queued') throw errors.conflict('Transcription is already running');
    const running = await prisma.aiJob.count({ where: { type: 'transcribe', episodeId: id, status: { in: ['queued', 'running'] } } });
    if (running > 0) throw errors.conflict('Transcription is already queued');
    const job = await prisma.aiJob.create({ data: { type: 'transcribe', episodeId: id, kinds: [], requestedBy: getAuth(req).user.id } });
    await prisma.transcript.upsert({ where: { episodeId: id }, update: { status: 'queued', error: null }, create: { episodeId: id, status: 'queued' } });
    await media.queue.enqueue({ type: 'transcribe', jobId: job.id, episodeId: id }, 1);
    await audit(req, 'transcribe.queue', 'episode', id, { jobId: job.id });
    res.status(202).json(toJob(job, new Map()));
  });

  // ───── Factory runs ─────
  router.post('/episodes/:id/factory', review, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(runFactoryInputSchema, req.body, 'body');
    if (!media.queue) throw unavailable();
    const episode = await prisma.episode.findUnique({ where: { id }, select: { id: true, transcript: { select: { status: true } } } });
    if (!episode) throw errors.notFound('Episode not found');
    if (episode.transcript?.status !== 'ready') throw errors.conflict('Transcribe the episode first');
    const running = await prisma.aiJob.count({ where: { type: 'content_factory', episodeId: id, status: { in: ['queued', 'running'] } } });
    if (running > 0) throw errors.conflict('The content factory is already running for this episode');
    const kinds = body.kinds ?? [...AI_DRAFT_KINDS];
    const job = await prisma.aiJob.create({ data: { type: 'content_factory', episodeId: id, kinds, requestedBy: getAuth(req).user.id } });
    await media.queue.enqueue({ type: 'content-factory', jobId: job.id, episodeId: id, kinds }, 1);
    await audit(req, 'factory.queue', 'episode', id, { jobId: job.id, kinds });
    res.status(202).json(toJob(job, new Map()));
  });

  router.get('/jobs', review, async (_req, res) => {
    const jobs = await prisma.aiJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const ids = [...new Set(jobs.map((j) => j.episodeId).filter((v): v is string => Boolean(v)))];
    const episodes = ids.length ? await prisma.episode.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }) : [];
    const titles = new Map(episodes.map((e) => [e.id, e.title]));
    res.json({ items: jobs.map((j) => toJob(j, titles)) });
  });

  // ───── Drafts ─────
  router.get('/drafts', review, async (req, res) => {
    const q = validate(adminAiDraftListQuerySchema, req.query, 'query');
    const where: Prisma.AiDraftWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.episodeId ? { episodeId: q.episodeId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.aiDraft.findMany({ where, include: draftInclude, orderBy: [{ createdAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.aiDraft.count({ where }),
    ]);
    const names = await reviewerNames(rows.map((r) => r.reviewerId));
    const response: AdminAiDraftList = { items: rows.map((r) => toDraft(r, names)), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  /** Writes an approved draft into the editorial record. Entities/topics link records; text kinds fill empty fields. */
  const apply = async (tx: Prisma.TransactionClient, draft: DraftRow, content: unknown) => {
    const episodeId = draft.episode.id;
    switch (draft.kind) {
      case 'summary': {
        const c = content as AiDraftContent<'summary'>;
        await tx.episode.update({ where: { id: episodeId }, data: { summary: c.summary } });
        return;
      }
      case 'show_notes': {
        const c = content as AiDraftContent<'show_notes'>;
        await tx.episode.update({ where: { id: episodeId }, data: { description: c.notes } });
        return;
      }
      case 'clip_candidates': {
        const c = content as AiDraftContent<'clip_candidates'>;
        for (const cand of c.candidates) {
          await tx.clip.create({
            data: { sourceEpisodeId: episodeId, title: cand.title, startTime: cand.start, endTime: cand.end, transcript: cand.transcript, confidence: cand.confidence, generationModel: draft.model, reviewStatus: 'review' },
          });
        }
        return;
      }
      case 'entities': {
        const c = content as AiDraftContent<'entities'>;
        for (const company of c.companies) {
          if (company.matchedCompanyId) await tx.episodeCompany.upsert({ where: { episodeId_companyId: { episodeId, companyId: company.matchedCompanyId } }, update: {}, create: { episodeId, companyId: company.matchedCompanyId } });
        }
        for (const project of c.projects) {
          if (project.matchedProjectId) await tx.episodeProject.upsert({ where: { episodeId_projectId: { episodeId, projectId: project.matchedProjectId } }, update: {}, create: { episodeId, projectId: project.matchedProjectId } });
        }
        return;
      }
      case 'topics': {
        const c = content as AiDraftContent<'topics'>;
        for (const name of c.topics) {
          const topic = await tx.topic.upsert({ where: { slug: slugify(name) }, update: {}, create: { slug: slugify(name), name } });
          await tx.episodeTopic.upsert({ where: { episodeId_topicId: { episodeId, topicId: topic.id } }, update: {}, create: { episodeId, topicId: topic.id } });
        }
        return;
      }
      default:
        // seo, chapters, quotes, social posts, newsletter and article drafts are approved for editors to use; distribution (Milestone 8) consumes them.
        return;
    }
  };

  router.post('/drafts/:id/review', publish, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const body = validate(aiDraftReviewInputSchema, req.body, 'body');
    const draft = await prisma.aiDraft.findUnique({ where: { id }, include: draftInclude });
    if (!draft) throw errors.notFound('Draft not found');
    if (draft.status !== 'review' && draft.status !== 'draft') throw errors.conflict(`Draft is already ${draft.status}`);

    let content: unknown = draft.content;
    if (body.content !== undefined) {
      const parsed = AI_DRAFT_CONTENT_SCHEMAS[draft.kind].safeParse(body.content);
      if (!parsed.success) throw errors.badRequest(`Edited content is not valid ${draft.kind}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      content = parsed.data;
    }
    if (body.decision === 'approve') {
      const missing = draft.moderationFlags.filter((f) => !body.acknowledgedFlags.includes(f));
      if (missing.length > 0) throw errors.badRequest(`Acknowledge every moderation flag before approving: ${missing.join(', ')}`);
    }
    const reviewer = getAuth(req).user.id;
    const updated = await prisma.$transaction(async (tx) => {
      if (body.decision === 'approve') await apply(tx, draft, content);
      return tx.aiDraft.update({
        where: { id },
        data: {
          status: body.decision === 'approve' ? 'approved' : 'rejected',
          content: content as Prisma.InputJsonValue,
          reviewerId: reviewer,
          reviewNote: body.note ?? null,
          reviewedAt: new Date(),
          appliedAt: body.decision === 'approve' ? new Date() : null,
        },
        include: draftInclude,
      });
    });
    await audit(req, `draft.${body.decision}`, 'ai_draft', id, { kind: draft.kind, episodeId: draft.episode.id, flags: draft.moderationFlags });
    res.json(toDraft(updated, await reviewerNames([reviewer])));
  });

  return router;
}
