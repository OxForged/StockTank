import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });

export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.record(z.string(), z.object({ ok: z.boolean(), latencyMs: z.number().optional(), error: z.string().optional() })),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;

export const versionResponseSchema = z.object({
  name: z.literal('stocktank-api'),
  version: z.string(),
  commit: z.string().nullable(),
  node: z.string(),
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;

export const featureFlagSchema = z.object({ key: z.string(), enabled: z.boolean(), description: z.string().nullable() });
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
