import { z } from 'zod';

/** Every public content item says whether it is seeded DEMO data (§52), so the UI can label it. */
const demoFlag = { isDemo: z.boolean() };

export const projectKindSchema = z.enum([
  'crypto_project',
  'protocol',
  'dao',
  'infrastructure',
  'rwa',
  'ecosystem',
  'application',
  'traditional_company',
]);
export type ProjectKind = z.infer<typeof projectKindSchema>;

export const showSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  episodeCount: z.number().int(),
  ...demoFlag,
});
export type ShowSummary = z.infer<typeof showSummarySchema>;

export const episodeSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  coverUrl: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  publishedAt: z.string().nullable(),
  show: z.object({ slug: z.string(), title: z.string() }),
  ...demoFlag,
});
export type EpisodeSummary = z.infer<typeof episodeSummarySchema>;

/** Only clips with reviewStatus=published are public (§14 human approval). */
export const clipSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  episode: z.object({ slug: z.string(), title: z.string() }),
  show: z.object({ slug: z.string(), title: z.string() }),
  ...demoFlag,
});
export type ClipSummary = z.infer<typeof clipSummarySchema>;

export const articleSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  publishedAt: z.string().nullable(),
  sourceName: z.string().nullable(),
  ...demoFlag,
});
export type ArticleSummary = z.infer<typeof articleSummarySchema>;

export const projectSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  symbol: z.string().nullable(),
  kind: projectKindSchema,
  description: z.string().nullable(),
  chainName: z.string().nullable(),
  logoUrl: z.string().nullable(),
  verified: z.boolean(),
  ...demoFlag,
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const companySummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  ticker: z.string().nullable(),
  exchange: z.string().nullable(),
  sector: z.string().nullable(),
  country: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  ...demoFlag,
});
export type CompanySummary = z.infer<typeof companySummarySchema>;

export const livestreamStatusSchema = z.enum(['scheduled', 'live', 'ended', 'cancelled']);
export type LivestreamStatus = z.infer<typeof livestreamStatusSchema>;

export const livestreamSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: livestreamStatusSchema,
  scheduledStart: z.string(),
  scheduledEnd: z.string().nullable(),
  /** Null until media/live infrastructure exists; the UI must not pretend to play. */
  streamUrl: z.string().nullable(),
  show: z.object({ slug: z.string(), title: z.string() }).nullable(),
  segments: z.array(z.object({ position: z.number().int(), title: z.string() })),
  ...demoFlag,
});
export type LivestreamSummary = z.infer<typeof livestreamSummarySchema>;

/** Aggregated homepage payload (hybrid layout). Every list may be empty. */
export const homeResponseSchema = z.object({
  featuredShows: z.array(showSummarySchema),
  latestEpisodes: z.array(episodeSummarySchema),
  clips: z.array(clipSummarySchema),
  explainers: z.array(articleSummarySchema),
  projects: z.array(projectSummarySchema),
  companies: z.array(companySummarySchema),
  /** Current live broadcast if one has status=live, else null. */
  live: livestreamSummarySchema.nullable(),
  /** Today's and upcoming broadcasts, soonest first (max 6). */
  rundown: z.array(livestreamSummarySchema),
  generatedAt: z.string(),
});
export type HomeResponse = z.infer<typeof homeResponseSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});

const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: z.number(), pageSize: z.number(), total: z.number() });

export const showListResponseSchema = paginated(showSummarySchema);
export type ShowListResponse = z.infer<typeof showListResponseSchema>;
export const projectListResponseSchema = paginated(projectSummarySchema);
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export const companyListResponseSchema = paginated(companySummarySchema);
export type CompanyListResponse = z.infer<typeof companyListResponseSchema>;

export const showDetailResponseSchema = z.object({
  show: showSummarySchema,
  episodes: z.array(episodeSummarySchema),
});
export type ShowDetailResponse = z.infer<typeof showDetailResponseSchema>;

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });

/** Grouped search results (§10 grouping). Postgres-backed until Meilisearch lands in Milestone 2. */
export const searchResponseSchema = z.object({
  query: z.string(),
  shows: z.array(showSummarySchema),
  episodes: z.array(episodeSummarySchema),
  projects: z.array(projectSummarySchema),
  companies: z.array(companySummarySchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
