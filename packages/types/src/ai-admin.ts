import { z } from 'zod';
import { publishStatusSchema } from './admin-content.js';

/** AI administration (§16–17 personalities, §49 cost monitoring). Every route here requires `ai.review`. */

/** Feature names used for usage rows and feature budgets (§49). */
export const AI_FEATURES = ['personality_chat', 'transcription', 'content_factory', 'entity_extraction', 'embedding', 'clip_candidates', 'summaries', 'social_drafts'] as const;
export const aiFeatureSchema = z.enum(AI_FEATURES);
export type AiFeature = z.infer<typeof aiFeatureSchema>;

export const aiBudgetScopeSchema = z.enum(['global', 'feature', 'personality']);
export type AiBudgetScope = z.infer<typeof aiBudgetScopeSchema>;

/** Statuses only editors with `content.publish` may set. */
export const AI_PERSONALITY_PUBLISH_STATUSES: ReadonlySet<string> = new Set(['published', 'archived', 'rejected']);

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const aiPersonalityInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug,
  description: z.string().trim().max(2000).nullable().optional(),
  tone: z.string().trim().max(200).nullable().optional(),
  expertise: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  /** Shown to the audience wherever the personality appears; never optional. */
  disclosures: z.string().trim().min(10).max(2000),
  voiceId: z.string().trim().max(200).nullable().optional(),
  avatarUrl: z.url().max(2000).nullable().optional(),
  status: publishStatusSchema.default('draft'),
  /** Only on create: the first prompt version. Later edits go through the prompt endpoint so every version is kept. */
  personalityPrompt: z.string().trim().min(1).max(20_000).optional(),
});
export type AiPersonalityInput = z.infer<typeof aiPersonalityInputSchema>;

export const aiPersonalitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  tone: z.string().nullable(),
  expertise: z.array(z.string()),
  disclosures: z.string(),
  voiceId: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: publishStatusSchema,
  hostId: z.string().nullable(),
  isDemo: z.boolean(),
  /** Server-side prompt (§17). Only returned on admin routes to holders of `ai.review`; never on public routes. */
  personalityPrompt: z.string(),
  /** 0 until a prompt has been written. */
  promptVersion: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AiPersonality = z.infer<typeof aiPersonalitySchema>;
export const aiPersonalityListSchema = z.object({ items: z.array(aiPersonalitySchema) });

export const aiPromptInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  note: z.string().trim().max(500).nullable().optional(),
});
export type AiPromptInput = z.infer<typeof aiPromptInputSchema>;

export const aiPromptVersionSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  content: z.string(),
  note: z.string().nullable(),
  createdById: z.string().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
});
export type AiPromptVersion = z.infer<typeof aiPromptVersionSchema>;
export const aiPromptVersionListSchema = z.object({ items: z.array(aiPromptVersionSchema) });

export const aiUsageQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>;

/** Costs are estimated micro-dollars (USD × 1e6). `unknownCostCalls` counts rows whose model has no configured price; those are excluded from sums. */
const costBucket = {
  calls: z.number().int(),
  failures: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costMicros: z.number().int(),
  unknownCostCalls: z.number().int(),
};

export const aiUsageReportSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  totals: z.object({
    ...costBucket,
    successes: z.number().int(),
    audioSeconds: z.number(),
    /** Null when no calls were recorded. */
    avgLatencyMs: z.number().nullable(),
  }),
  daily: z.array(z.object({ date: z.string(), calls: z.number().int(), costMicros: z.number().int(), unknownCostCalls: z.number().int() })),
  byFeature: z.array(z.object({ feature: z.string(), ...costBucket })),
  byModel: z.array(z.object({ provider: z.string(), model: z.string(), ...costBucket })),
  byPersonality: z.array(z.object({ personalityId: z.string().nullable(), name: z.string(), ...costBucket })),
  /** UTC day and calendar month to date, independent of the requested range. */
  spendTodayMicros: z.number().int(),
  spendMonthMicros: z.number().int(),
  unknownCostCallsToday: z.number().int(),
  unknownCostCallsMonth: z.number().int(),
});
export type AiUsageReport = z.infer<typeof aiUsageReportSchema>;

export const aiBudgetInputSchema = z
  .object({
    scope: aiBudgetScopeSchema,
    /** Feature name or personality id; must be empty for the global budget. */
    scopeKey: z.string().trim().max(64).default(''),
    monthlyLimitMicros: z.number().int().positive().max(1_000_000_000_000),
    /** Hard limits block new calls once reached; soft limits only warn on the dashboard. */
    hardLimit: z.boolean().default(true),
  })
  .refine((v) => (v.scope === 'global' ? v.scopeKey === '' : v.scopeKey !== ''), { message: 'Global budgets have no key; feature and personality budgets need one', path: ['scopeKey'] })
  .refine((v) => v.scope !== 'feature' || (AI_FEATURES as readonly string[]).includes(v.scopeKey), { message: 'Unknown AI feature', path: ['scopeKey'] });
export type AiBudgetInput = z.infer<typeof aiBudgetInputSchema>;

export const aiBudgetSchema = z.object({
  id: z.string(),
  scope: aiBudgetScopeSchema,
  scopeKey: z.string(),
  /** Human label: "All AI", the feature name, or the personality name. */
  label: z.string(),
  monthlyLimitMicros: z.number().int(),
  hardLimit: z.boolean(),
  /** Estimated spend this calendar month (UTC) within the budget's scope. */
  spentMicros: z.number().int(),
  /** 0–100+, one decimal. */
  percentUsed: z.number(),
  /** Calls this month in scope whose cost is unknown and therefore not counted. */
  unknownCostCalls: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AiBudget = z.infer<typeof aiBudgetSchema>;
export const aiBudgetListSchema = z.object({ items: z.array(aiBudgetSchema) });

const providerInfo = z.object({ provider: z.string(), model: z.string() });

/** Which AI providers the API has configured. Never includes keys. */
export const aiStatusSchema = z.object({
  llm: providerInfo.nullable(),
  fastLlm: providerInfo.nullable(),
  embeddings: providerInfo.extend({ dimensions: z.number().int() }).nullable(),
  transcription: providerInfo.nullable(),
  /** Model ids with configured prices; calls to any other model are recorded with unknown cost. */
  pricedModels: z.array(z.string()),
  /** Plain-language setup hints naming the environment variables to set. */
  setup: z.array(z.string()),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;
