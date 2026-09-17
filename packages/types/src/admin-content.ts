import { z } from 'zod';
import {
  articleSummarySchema,
  companySummarySchema,
  episodeSummarySchema,
  livestreamStatusSchema,
  livestreamSummarySchema,
  personSummarySchema,
  projectKindSchema,
  projectSummarySchema,
  showSummarySchema,
} from './content.js';

/**
 * Editorial workflow states (README §27). `content.write` may move items between draft and review;
 * `content.publish` is required to publish, archive or reject.
 */
export const publishStatusSchema = z.enum(['draft', 'review', 'approved', 'rejected', 'published', 'archived']);
export type PublishStatus = z.infer<typeof publishStatusSchema>;
export const PUBLISH_ONLY_STATUSES: ReadonlySet<PublishStatus> = new Set(['approved', 'rejected', 'published', 'archived']);

const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL')
  .nullable()
  .optional();

const editorialMeta = {
  status: publishStatusSchema,
  updatedAt: z.string(),
};

// ───────── Shows ─────────

export const showInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: slug.optional(),
  tagline: optionalText(200),
  description: optionalText(4000),
  coverUrl: optionalUrl,
  hostIds: z.array(z.string()).max(20).default([]),
  status: publishStatusSchema.default('draft'),
});
export type ShowInput = z.infer<typeof showInputSchema>;
export const adminShowSchema = showSummarySchema.extend({ ...editorialMeta, hostIds: z.array(z.string()) });
export type AdminShow = z.infer<typeof adminShowSchema>;

// ───────── Episodes ─────────

export const episodeInputSchema = z.object({
  showId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  slug: slug.optional(),
  number: z.number().int().min(0).max(100_000).nullable().optional(),
  summary: optionalText(500),
  description: optionalText(20_000),
  coverUrl: optionalUrl,
  durationSeconds: z.number().int().min(0).max(24 * 3600).nullable().optional(),
  status: publishStatusSchema.default('draft'),
  /** Defaults to now when publishing without a date. */
  publishedAt: z.iso.datetime().nullable().optional(),
  projectIds: z.array(z.string()).max(50).default([]),
  companyIds: z.array(z.string()).max(50).default([]),
  hostIds: z.array(z.string()).max(20).default([]),
  guestIds: z.array(z.string()).max(50).default([]),
});
export type EpisodeInput = z.infer<typeof episodeInputSchema>;
export const adminEpisodeSchema = episodeSummarySchema.extend({
  ...editorialMeta,
  showId: z.string(),
  number: z.number().int().nullable(),
  description: z.string().nullable(),
  projectIds: z.array(z.string()),
  companyIds: z.array(z.string()),
  hostIds: z.array(z.string()),
  guestIds: z.array(z.string()),
});
export type AdminEpisode = z.infer<typeof adminEpisodeSchema>;

// ───────── Projects & companies ─────────

export const projectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slug.optional(),
  symbol: z.string().trim().max(20).nullable().optional(),
  kind: projectKindSchema.default('crypto_project'),
  description: optionalText(4000),
  logoUrl: optionalUrl,
  website: optionalUrl,
  twitter: optionalText(100),
  chainSlug: z.string().trim().max(60).nullable().optional(),
  contractAddress: optionalText(120),
  verified: z.boolean().default(false),
  status: publishStatusSchema.default('draft'),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;
export const adminProjectSchema = projectSummarySchema.extend({
  ...editorialMeta,
  website: z.string().nullable(),
  twitter: z.string().nullable(),
  chainSlug: z.string().nullable(),
  contractAddress: z.string().nullable(),
});
export type AdminProject = z.infer<typeof adminProjectSchema>;

export const companyInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slug.optional(),
  ticker: z.string().trim().max(12).nullable().optional(),
  exchange: z.string().trim().max(20).nullable().optional(),
  sector: optionalText(80),
  industry: optionalText(120),
  country: optionalText(80),
  description: optionalText(4000),
  logoUrl: optionalUrl,
  website: optionalUrl,
  status: publishStatusSchema.default('draft'),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;
export const adminCompanySchema = companySummarySchema.extend({
  ...editorialMeta,
  industry: z.string().nullable(),
  website: z.string().nullable(),
});
export type AdminCompany = z.infer<typeof adminCompanySchema>;

// ───────── Articles ─────────

export const articleInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: slug.optional(),
  summary: optionalText(600),
  body: optionalText(100_000),
  author: optionalText(120),
  /** Original reporting link when summarising a third-party source (§23: summarise, attribute, never republish). */
  originalUrl: optionalUrl,
  status: publishStatusSchema.default('draft'),
  publishedAt: z.iso.datetime().nullable().optional(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;
export const adminArticleSchema = articleSummarySchema.extend({
  ...editorialMeta,
  body: z.string().nullable(),
  author: z.string().nullable(),
  originalUrl: z.string().nullable(),
});
export type AdminArticle = z.infer<typeof adminArticleSchema>;

// ───────── People (hosts & guests) ─────────

export const personInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slug.optional(),
  title: optionalText(160),
  bio: optionalText(4000),
  avatarUrl: optionalUrl,
  twitter: optionalText(100),
  website: optionalUrl,
  /** Hosts only. AI personalities are always labelled on the site. */
  isAi: z.boolean().default(false),
});
export type PersonInput = z.infer<typeof personInputSchema>;
export const adminPersonSchema = personSummarySchema.extend({
  website: z.string().nullable(),
  appearances: z.number().int(),
  updatedAt: z.string(),
});
export type AdminPerson = z.infer<typeof adminPersonSchema>;
export const adminPersonListSchema = z.object({ items: z.array(adminPersonSchema), page: z.number(), pageSize: z.number(), total: z.number() });

export const reindexResponseSchema = z.object({
  engine: z.enum(['meilisearch', 'postgres']),
  indexed: z.record(z.string(), z.number().int()),
});
export type ReindexResponse = z.infer<typeof reindexResponseSchema>;

// ───────── Live schedule ─────────

export const livestreamInputSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    showId: z.string().nullable().optional(),
    description: optionalText(2000),
    status: livestreamStatusSchema.default('scheduled'),
    scheduledStart: z.iso.datetime(),
    scheduledEnd: z.iso.datetime().nullable().optional(),
    streamUrl: optionalUrl,
    segments: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  })
  .refine((l) => !l.scheduledEnd || new Date(l.scheduledEnd) > new Date(l.scheduledStart), {
    message: 'End must be after start',
    path: ['scheduledEnd'],
  });
export type LivestreamInput = z.infer<typeof livestreamInputSchema>;
export const adminLivestreamSchema = livestreamSummarySchema.extend({ showId: z.string().nullable(), updatedAt: z.string() });
export type AdminLivestream = z.infer<typeof adminLivestreamSchema>;

// ───────── Lists ─────────

export const adminContentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: publishStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
});

const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.number(), pageSize: z.number(), total: z.number() });

export const adminShowListSchema = list(adminShowSchema);
export const adminEpisodeListSchema = list(adminEpisodeSchema);
export const adminProjectListSchema = list(adminProjectSchema);
export const adminCompanyListSchema = list(adminCompanySchema);
export const adminArticleListSchema = list(adminArticleSchema);
export const adminLivestreamListSchema = list(adminLivestreamSchema);
export type AdminList<T> = { items: T[]; page: number; pageSize: number; total: number };

export const chainOptionSchema = z.object({ slug: z.string(), name: z.string() });
export type ChainOption = z.infer<typeof chainOptionSchema>;

// ───────── Engagement (signed-in audience) ─────────

export const followTargetSchema = z.enum(['show', 'project', 'company']);
export type FollowTarget = z.infer<typeof followTargetSchema>;

export const followRequestSchema = z.object({ target: followTargetSchema, id: z.string().min(1).max(64) });
export type FollowRequest = z.infer<typeof followRequestSchema>;

export const libraryResponseSchema = z.object({
  shows: z.array(showSummarySchema),
  projects: z.array(projectSummarySchema),
  companies: z.array(companySummarySchema),
  bookmarks: z.array(episodeSummarySchema.extend({ positionSeconds: z.number().int(), bookmarkedAt: z.string() })),
});
export type LibraryResponse = z.infer<typeof libraryResponseSchema>;

export const bookmarkRequestSchema = z.object({
  episodeId: z.string().min(1).max(64),
  positionSeconds: z.number().int().min(0).max(24 * 3600).default(0),
});
