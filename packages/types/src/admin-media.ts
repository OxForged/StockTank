import { z } from 'zod';
import { publishStatusSchema } from './admin-content.js';
import { clipMediaSchema, episodeMediaSchema, mediaKindSchema, mediaStatusSchema, mediaUploadMimeSchema } from './media.js';

// ───── Admin: uploads and assets ─────

export const createMediaUploadInputSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: mediaUploadMimeSchema,
  sizeBytes: z.number().int().positive(),
  /** When set, the episode switches to this asset once processing succeeds. */
  episodeId: z.string().min(1).max(64).optional(),
});
export type CreateMediaUploadInput = z.infer<typeof createMediaUploadInputSchema>;

export const adminMediaAssetSchema = z.object({
  id: z.string(),
  kind: mediaKindSchema,
  status: mediaStatusSchema,
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  durationSeconds: z.number().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  progress: z.number().int(),
  attempts: z.number().int(),
  error: z.string().nullable(),
  targetEpisodeId: z.string().nullable(),
  /** Episode currently playing this asset, if any. */
  episodeId: z.string().nullable(),
  playback: episodeMediaSchema.nullable(),
  createdAt: z.string(),
  readyAt: z.string().nullable(),
});
export type AdminMediaAsset = z.infer<typeof adminMediaAssetSchema>;

export const createMediaUploadResponseSchema = z.object({
  asset: adminMediaAssetSchema,
  upload: z.object({
    method: z.literal('PUT'),
    url: z.string(),
    /** Headers the browser must send with the PUT; the signature covers them. */
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string(),
  }),
});
export type CreateMediaUploadResponse = z.infer<typeof createMediaUploadResponseSchema>;

export const adminMediaAssetListQuerySchema = z.object({
  status: mediaStatusSchema.optional(),
  episodeId: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminMediaAssetListSchema = z.object({
  items: z.array(adminMediaAssetSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type AdminMediaAssetList = z.infer<typeof adminMediaAssetListSchema>;

export const mediaStatusResponseSchema = z.object({
  storageConfigured: z.boolean(),
  queueConfigured: z.boolean(),
  maxUploadBytes: z.number().int(),
  acceptedMimeTypes: z.array(z.string()),
});
export type MediaStatusResponse = z.infer<typeof mediaStatusResponseSchema>;

// ───── Admin: clips (§14: always tied to source timestamps; public only after review) ─────

/** Longest clip staff can cut by hand. Longer segments belong in a separate episode. */
export const MAX_CLIP_SECONDS = 600;

const clipTimesSchema = z
  .object({ startTime: z.number().min(0), endTime: z.number().positive() })
  .refine((v) => v.endTime > v.startTime, { message: 'endTime must be after startTime', path: ['endTime'] })
  .refine((v) => v.endTime - v.startTime <= MAX_CLIP_SECONDS, { message: `Clips can be at most ${MAX_CLIP_SECONDS} seconds`, path: ['endTime'] });

export const clipInputSchema = z
  .object({
    sourceEpisodeId: z.string().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    startTime: z.number().min(0),
    endTime: z.number().positive(),
    transcript: z.string().trim().max(10_000).nullable().optional(),
    reviewStatus: publishStatusSchema.default('draft'),
  })
  .and(clipTimesSchema);
export type ClipInput = z.infer<typeof clipInputSchema>;

export const adminClipSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  transcript: z.string().nullable(),
  confidence: z.number().nullable(),
  generationModel: z.string().nullable(),
  reviewStatus: publishStatusSchema,
  renderStatus: mediaStatusSchema.nullable(),
  renderError: z.string().nullable(),
  media: clipMediaSchema.nullable(),
  sourceEpisode: z.object({ id: z.string(), title: z.string(), slug: z.string(), showSlug: z.string(), hasMedia: z.boolean() }),
  isDemo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminClip = z.infer<typeof adminClipSchema>;

export const adminClipListQuerySchema = z.object({
  reviewStatus: publishStatusSchema.optional(),
  episodeId: z.string().min(1).max(64).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminClipListSchema = z.object({
  items: z.array(adminClipSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type AdminClipList = z.infer<typeof adminClipListSchema>;
