import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@stocktank/database';
import { ACCEPTED_MEDIA, keys } from '@stocktank/media';
import {
  MEDIA_UPLOAD_MIME_TYPES,
  PUBLISH_ONLY_STATUSES,
  adminClipListQuerySchema,
  adminMediaAssetListQuerySchema,
  clipInputSchema,
  createMediaUploadInputSchema,
  type AdminClip,
  type AdminClipList,
  type AdminMediaAsset,
  type AdminMediaAssetList,
  type CreateMediaUploadResponse,
  type MediaStatusResponse,
  type PublishStatus,
} from '@stocktank/types';
import { writeAudit } from '../lib/audit.js';
import { AppError, errors } from '../lib/errors.js';
import { toClipMedia, toEpisodeMedia, type MediaService } from '../lib/media.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';

export interface AdminMediaDeps {
  prisma: PrismaClient;
  media: MediaService;
}

const idParams = z.object({ id: z.string().min(1).max(64) });
const UPLOAD_URL_TTL_SECONDS = 3600;

const unavailable = (what: string) => new AppError('INTERNAL', `${what} is not configured on this server`, undefined, 503);

const assetSelect = {
  id: true,
  kind: true,
  status: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  durationSeconds: true,
  width: true,
  height: true,
  progress: true,
  attempts: true,
  error: true,
  targetEpisodeId: true,
  renditions: true,
  createdAt: true,
  readyAt: true,
  originalKey: true,
  episode: { select: { id: true } },
} satisfies Prisma.MediaAssetSelect;
type AssetRow = Prisma.MediaAssetGetPayload<{ select: typeof assetSelect }>;

const clipSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  transcript: true,
  confidence: true,
  generationModel: true,
  reviewStatus: true,
  renderStatus: true,
  renderError: true,
  renditions: true,
  isDemo: true,
  createdAt: true,
  updatedAt: true,
  sourceEpisode: { select: { id: true, title: true, slug: true, mediaAssetId: true, show: { select: { slug: true } } } },
} satisfies Prisma.ClipSelect;
type ClipRow = Prisma.ClipGetPayload<{ select: typeof clipSelect }>;

export function adminMediaRouter({ prisma, media }: AdminMediaDeps): Router {
  const router = Router();
  const read = requirePermission('content.read_drafts');
  const write = requirePermission('content.write');

  const audit = (req: Request, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonObject) =>
    writeAudit(prisma, req, { action: `content.${action}` as const, actorId: getAuth(req).user.id, targetType, targetId, ...(metadata ? { metadata } : {}) });

  const toAdminAsset = (r: AssetRow): AdminMediaAsset => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    originalName: r.originalName,
    mimeType: r.mimeType,
    sizeBytes: Number(r.sizeBytes),
    durationSeconds: r.durationSeconds,
    width: r.width,
    height: r.height,
    progress: r.progress,
    attempts: r.attempts,
    error: r.error,
    targetEpisodeId: r.targetEpisodeId,
    episodeId: r.episode?.id ?? null,
    playback: toEpisodeMedia(r, media.publicUrl),
    createdAt: r.createdAt.toISOString(),
    readyAt: r.readyAt?.toISOString() ?? null,
  });

  const toAdminClip = (r: ClipRow): AdminClip => ({
    id: r.id,
    title: r.title,
    startTime: r.startTime,
    endTime: r.endTime,
    transcript: r.transcript,
    confidence: r.confidence,
    generationModel: r.generationModel,
    reviewStatus: r.reviewStatus,
    renderStatus: r.renderStatus,
    renderError: r.renderError,
    media: toClipMedia(r, media.publicUrl),
    sourceEpisode: {
      id: r.sourceEpisode.id,
      title: r.sourceEpisode.title,
      slug: r.sourceEpisode.slug,
      showSlug: r.sourceEpisode.show.slug,
      hasMedia: r.sourceEpisode.mediaAssetId !== null,
    },
    isDemo: r.isDemo,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });

  const requireQueue = () => {
    if (!media.queue) throw unavailable('The media processing queue');
    return media.queue;
  };

  // ───── Capabilities ─────
  router.get('/status', read, (_req, res) => {
    const response: MediaStatusResponse = {
      storageConfigured: media.storage !== null,
      queueConfigured: media.queue !== null,
      maxUploadBytes: media.maxUploadBytes,
      acceptedMimeTypes: [...MEDIA_UPLOAD_MIME_TYPES],
    };
    res.json(response);
  });

  // ───── Assets ─────
  router.get('/assets', read, async (req, res) => {
    const q = validate(adminMediaAssetListQuerySchema, req.query, 'query');
    const where: Prisma.MediaAssetWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.episodeId ? { OR: [{ targetEpisodeId: q.episodeId }, { episode: { id: q.episodeId } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.mediaAsset.findMany({ where, select: assetSelect, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.mediaAsset.count({ where }),
    ]);
    const response: AdminMediaAssetList = { items: rows.map(toAdminAsset), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  router.get('/assets/:id', read, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const row = await prisma.mediaAsset.findUnique({ where: { id }, select: assetSelect });
    if (!row) throw errors.notFound('Media asset not found');
    res.json(toAdminAsset(row));
  });

  /** Step 1: reserve an asset and hand the browser a short-lived presigned PUT straight to object storage. */
  router.post('/uploads', write, async (req, res) => {
    const body = validate(createMediaUploadInputSchema, req.body, 'body');
    if (!media.storage) throw unavailable('Media storage');
    requireQueue();
    if (body.sizeBytes > media.maxUploadBytes) {
      throw errors.badRequest(`Files can be at most ${Math.floor(media.maxUploadBytes / (1024 * 1024))} MB`);
    }
    if (body.episodeId && !(await prisma.episode.findUnique({ where: { id: body.episodeId }, select: { id: true } }))) {
      throw errors.badRequest('Episode not found');
    }
    const accepted = ACCEPTED_MEDIA[body.mimeType];
    // Asset ids are generated here so the object key is known before the row exists (no update round trip).
    const id = `ma${randomBytes(12).toString('hex')}`;
    const originalKey = keys.original(id, accepted.extension);
    const row = await prisma.mediaAsset.create({
      data: {
        id,
        kind: accepted.kind,
        originalKey,
        originalName: body.filename,
        mimeType: body.mimeType,
        sizeBytes: BigInt(body.sizeBytes),
        createdById: getAuth(req).user.id,
        targetEpisodeId: body.episodeId ?? null,
      },
      select: assetSelect,
    });
    const url = await media.storage.presignUpload(originalKey, body.mimeType, body.sizeBytes, UPLOAD_URL_TTL_SECONDS);
    await audit(req, 'media.upload_started', 'media_asset', id, { kind: accepted.kind, sizeBytes: body.sizeBytes, episodeId: body.episodeId ?? null });
    const response: CreateMediaUploadResponse = {
      asset: toAdminAsset(row),
      upload: {
        method: 'PUT',
        url,
        headers: { 'Content-Type': body.mimeType },
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      },
    };
    res.status(201).json(response);
  });

  /** Step 2: the browser reports the PUT finished; we verify the object really exists before queueing work. */
  router.post('/assets/:id/complete', write, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    if (!media.storage) throw unavailable('Media storage');
    const queue = requireQueue();
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: assetSelect });
    if (!asset) throw errors.notFound('Media asset not found');
    if (asset.status !== 'pending_upload') throw errors.conflict(`Upload already completed (status: ${asset.status})`);

    const head = await media.storage.head(asset.originalKey);
    if (!head) throw errors.badRequest('The upload has not reached storage yet');
    if (head.size !== Number(asset.sizeBytes)) {
      throw errors.badRequest(`Uploaded size ${head.size} does not match the declared ${Number(asset.sizeBytes)} bytes`);
    }
    // Conditional update guards against two concurrent completes both enqueueing.
    const claimed = await prisma.mediaAsset.updateMany({ where: { id, status: 'pending_upload' }, data: { status: 'uploaded', attempts: 1 } });
    if (claimed.count === 0) throw errors.conflict('Upload already completed');
    await queue.enqueue({ type: 'transcode', assetId: id }, 1);
    await audit(req, 'media.upload_completed', 'media_asset', id);
    const row = await prisma.mediaAsset.findUniqueOrThrow({ where: { id }, select: assetSelect });
    res.json(toAdminAsset(row));
  });

  router.post('/assets/:id/retry', write, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const queue = requireQueue();
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: assetSelect });
    if (!asset) throw errors.notFound('Media asset not found');
    if (asset.status !== 'failed') throw errors.conflict('Only failed assets can be retried');
    const attempt = asset.attempts + 1;
    const claimed = await prisma.mediaAsset.updateMany({
      where: { id, status: 'failed' },
      data: { status: 'uploaded', attempts: attempt, error: null, progress: 0 },
    });
    if (claimed.count === 0) throw errors.conflict('Asset is already being retried');
    await queue.enqueue({ type: 'transcode', assetId: id }, attempt);
    await audit(req, 'media.retry', 'media_asset', id, { attempt });
    res.json(toAdminAsset(await prisma.mediaAsset.findUniqueOrThrow({ where: { id }, select: assetSelect })));
  });

  /** Detaches media from an episode (the asset and its files are kept for the audit trail). */
  router.post('/episodes/:id/detach', write, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const episode = await prisma.episode.findUnique({ where: { id }, select: { mediaAssetId: true } });
    if (!episode) throw errors.notFound('Episode not found');
    await prisma.$transaction([
      prisma.episode.update({ where: { id }, data: { mediaAssetId: null } }),
      prisma.mediaAsset.updateMany({ where: { targetEpisodeId: id }, data: { targetEpisodeId: null } }),
    ]);
    await audit(req, 'media.detach', 'episode', id, { mediaAssetId: episode.mediaAssetId });
    res.status(204).end();
  });

  // ───── Clips ─────
  const assertCanSetReviewStatus = (req: Request, status: PublishStatus) => {
    if (PUBLISH_ONLY_STATUSES.has(status) && !getAuth(req).permissions.includes('content.publish')) {
      throw errors.forbidden(`Setting status "${status}" requires the content.publish permission`);
    }
  };

  router.get('/clips', read, async (req, res) => {
    const q = validate(adminClipListQuerySchema, req.query, 'query');
    const where: Prisma.ClipWhereInput = {
      ...(q.reviewStatus ? { reviewStatus: q.reviewStatus } : {}),
      ...(q.episodeId ? { sourceEpisodeId: q.episodeId } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.clip.findMany({ where, select: clipSelect, orderBy: [{ updatedAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.clip.count({ where }),
    ]);
    const response: AdminClipList = { items: rows.map(toAdminClip), page: q.page, pageSize: q.pageSize, total };
    res.json(response);
  });

  const saveClip = async (req: Request, id: string | null) => {
    const body = validate(clipInputSchema, req.body, 'body');
    assertCanSetReviewStatus(req, body.reviewStatus);
    const episode = await prisma.episode.findUnique({ where: { id: body.sourceEpisodeId }, select: { id: true } });
    if (!episode) throw errors.badRequest('Source episode not found');

    if (id) {
      const existing = await prisma.clip.findUnique({ where: { id }, select: { startTime: true, endTime: true, sourceEpisodeId: true } });
      if (!existing) throw errors.notFound('Clip not found');
      const cutChanged = existing.startTime !== body.startTime || existing.endTime !== body.endTime || existing.sourceEpisodeId !== body.sourceEpisodeId;
      const row = await prisma.clip.update({
        where: { id },
        data: {
          title: body.title,
          startTime: body.startTime,
          endTime: body.endTime,
          sourceEpisodeId: body.sourceEpisodeId,
          transcript: body.transcript ?? null,
          reviewStatus: body.reviewStatus,
          // A new cut invalidates rendered files; staff must render again.
          ...(cutChanged ? { renditions: Prisma.DbNull, renderStatus: null, renderError: null } : {}),
        },
        select: clipSelect,
      });
      await audit(req, 'clip.update', 'clip', id, { reviewStatus: body.reviewStatus, cutChanged });
      return row;
    }
    const row = await prisma.clip.create({
      data: {
        title: body.title,
        startTime: body.startTime,
        endTime: body.endTime,
        sourceEpisodeId: body.sourceEpisodeId,
        transcript: body.transcript ?? null,
        reviewStatus: body.reviewStatus,
      },
      select: clipSelect,
    });
    await audit(req, 'clip.create', 'clip', row.id, { reviewStatus: body.reviewStatus });
    return row;
  };

  router.post('/clips', write, async (req, res) => {
    res.status(201).json(toAdminClip(await saveClip(req, null)));
  });

  router.put('/clips/:id', write, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    res.json(toAdminClip(await saveClip(req, id)));
  });

  router.post('/clips/:id/render', write, async (req, res) => {
    const { id } = validate(idParams, req.params, 'params');
    const queue = requireQueue();
    const clip = await prisma.clip.findUnique({
      where: { id },
      select: { renderStatus: true, updatedAt: true, sourceEpisode: { select: { mediaAsset: { select: { status: true } } } } },
    });
    if (!clip) throw errors.notFound('Clip not found');
    if (clip.sourceEpisode.mediaAsset?.status !== 'ready') throw errors.conflict('The source episode has no processed media yet');
    if (clip.renderStatus === 'uploaded' || clip.renderStatus === 'processing') throw errors.conflict('This clip is already rendering');
    const claimed = await prisma.clip.updateMany({
      where: { id, OR: [{ renderStatus: null }, { renderStatus: { in: ['ready', 'failed'] } }] },
      data: { renderStatus: 'uploaded', renderError: null },
    });
    if (claimed.count === 0) throw errors.conflict('This clip is already rendering');
    // Each render gets a fresh job id; the timestamp keeps re-renders after edits distinct.
    await queue.enqueue({ type: 'render-clip', clipId: id }, Date.now());
    await audit(req, 'clip.render', 'clip', id);
    res.status(202).json(toAdminClip(await prisma.clip.findUniqueOrThrow({ where: { id }, select: clipSelect })));
  });

  return router;
}
