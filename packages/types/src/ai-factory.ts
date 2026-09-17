import { z } from 'zod';

/** AI content factory (§20): draft shapes per kind. Everything is reviewed by a human before publication (§56). */

export const AI_DRAFT_KINDS = ['summary', 'show_notes', 'seo', 'chapters', 'quotes', 'clip_candidates', 'social_posts', 'newsletter', 'article', 'entities', 'topics'] as const;
export const aiDraftKindSchema = z.enum(AI_DRAFT_KINDS);
export type AiDraftKind = z.infer<typeof aiDraftKindSchema>;
export const aiDraftStatusSchema = z.enum(['draft', 'review', 'approved', 'rejected', 'published']);
export type AiDraftStatus = z.infer<typeof aiDraftStatusSchema>;

/** A pointer into the transcript the reviewer can jump to. */
export const citationSchema = z.object({ start: z.number().min(0), end: z.number().min(0), quote: z.string().max(400) });
export type Citation = z.infer<typeof citationSchema>;

export const summaryDraftSchema = z.object({ summary: z.string().min(20).max(700) });
export const showNotesDraftSchema = z.object({ notes: z.string().min(50).max(6000), keyPoints: z.array(z.string().max(300)).max(10) });
export const seoDraftSchema = z.object({ title: z.string().min(10).max(70), description: z.string().min(40).max(160), keywords: z.array(z.string().max(40)).max(10) });
export const chaptersDraftSchema = z.object({ chapters: z.array(z.object({ start: z.number().min(0), title: z.string().min(3).max(120) })).min(2).max(30) });
export const quotesDraftSchema = z.object({
  /** Verbatim transcript quotes only; the generator verifies each against the transcript text. */
  quotes: z.array(z.object({ quote: z.string().min(20).max(400), speaker: z.string().nullable(), start: z.number().min(0), end: z.number().min(0), why: z.string().max(200) })).max(10),
});
export const clipCandidatesDraftSchema = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        start: z.number().min(0),
        end: z.number().min(0),
        /** 30 | 60 | 90 second target from §14. */
        targetSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]),
        reason: z.enum(['strong_statement', 'important_moment', 'question', 'debate', 'high_information', 'explanation', 'humor']),
        transcript: z.string().max(2000),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(12),
});
export const socialPostsDraftSchema = z.object({
  posts: z.array(z.object({ platform: z.enum(['x', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook']), text: z.string().min(10).max(2200), hashtags: z.array(z.string().max(30)).max(8) })).max(12),
});
export const newsletterDraftSchema = z.object({ subject: z.string().min(5).max(90), preheader: z.string().max(140), body: z.string().min(100).max(8000) });
export const articleDraftSchema = z.object({ title: z.string().min(10).max(120), summary: z.string().min(40).max(300), body: z.string().min(300).max(20000) });
export const entitiesDraftSchema = z.object({
  companies: z.array(z.object({ name: z.string(), evidence: z.string().max(300), matchedCompanyId: z.string().nullable() })).max(50),
  projects: z.array(z.object({ name: z.string(), symbol: z.string().nullable(), evidence: z.string().max(300), matchedProjectId: z.string().nullable() })).max(50),
  people: z.array(z.object({ name: z.string(), role: z.string().nullable(), evidence: z.string().max(300) })).max(50),
});
export const topicsDraftSchema = z.object({ topics: z.array(z.string().min(2).max(60)).min(1).max(12), tags: z.array(z.string().min(2).max(40)).max(20) });

export const AI_DRAFT_CONTENT_SCHEMAS = {
  summary: summaryDraftSchema,
  show_notes: showNotesDraftSchema,
  seo: seoDraftSchema,
  chapters: chaptersDraftSchema,
  quotes: quotesDraftSchema,
  clip_candidates: clipCandidatesDraftSchema,
  social_posts: socialPostsDraftSchema,
  newsletter: newsletterDraftSchema,
  article: articleDraftSchema,
  entities: entitiesDraftSchema,
  topics: topicsDraftSchema,
} as const satisfies Record<AiDraftKind, z.ZodType>;

export type AiDraftContent<K extends AiDraftKind = AiDraftKind> = z.infer<(typeof AI_DRAFT_CONTENT_SCHEMAS)[K]>;

export const transcriptSegmentSchema = z.object({ start: z.number(), end: z.number(), text: z.string(), speaker: z.string().nullable(), confidence: z.number().nullable() });
export type TranscriptSegmentDto = z.infer<typeof transcriptSegmentSchema>;

// ───── Admin API shapes ─────

export const adminTranscriptSchema = z.object({
  episodeId: z.string(),
  status: z.enum(['queued', 'processing', 'ready', 'failed']),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  language: z.string().nullable(),
  text: z.string().nullable(),
  segments: z.array(transcriptSegmentSchema),
  speakers: z.array(z.string()),
  confidence: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  error: z.string().nullable(),
  updatedAt: z.string(),
});
export type AdminTranscript = z.infer<typeof adminTranscriptSchema>;

export const adminAiDraftSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  episodeTitle: z.string(),
  showTitle: z.string(),
  kind: aiDraftKindSchema,
  status: aiDraftStatusSchema,
  content: z.unknown(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  citations: z.array(citationSchema),
  moderationFlags: z.array(z.string()),
  reviewer: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminAiDraft = z.infer<typeof adminAiDraftSchema>;

export const adminAiDraftListQuerySchema = z.object({
  status: aiDraftStatusSchema.optional(),
  kind: aiDraftKindSchema.optional(),
  episodeId: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const adminAiDraftListSchema = z.object({ items: z.array(adminAiDraftSchema), page: z.number().int(), pageSize: z.number().int(), total: z.number().int() });
export type AdminAiDraftList = z.infer<typeof adminAiDraftListSchema>;

export const aiDraftReviewInputSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).nullable().optional(),
  /** Every moderation flag on the draft must be acknowledged to approve. */
  acknowledgedFlags: z.array(z.string()).default([]),
  /** Optional reviewer edits, validated against the kind's schema before saving. */
  content: z.unknown().optional(),
});
export type AiDraftReviewInput = z.infer<typeof aiDraftReviewInputSchema>;

export const aiJobSchema = z.object({
  id: z.string(),
  type: z.enum(['transcribe', 'content_factory']),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  episodeId: z.string().nullable(),
  episodeTitle: z.string().nullable(),
  kinds: z.array(z.string()),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AiJob = z.infer<typeof aiJobSchema>;
export const aiJobListSchema = z.object({ items: z.array(aiJobSchema) });

export const runFactoryInputSchema = z.object({ kinds: z.array(aiDraftKindSchema).min(1).max(AI_DRAFT_KINDS.length).optional() });
