import { z } from 'zod';

/**
 * AI cost estimation (§49). Prices change and differ by contract, so they are configuration: defaults exist only
 * for models whose public list price was known when this was written, and anything else is recorded as unknown
 * cost rather than a guessed number. Override or extend with AI_MODEL_PRICING (JSON).
 */

export const modelPriceSchema = z.object({
  /** USD per million input tokens. */
  inputPerMTok: z.number().nonnegative().optional(),
  /** USD per million output tokens. */
  outputPerMTok: z.number().nonnegative().optional(),
  /** USD per minute of audio (transcription). */
  perAudioMinute: z.number().nonnegative().optional(),
});
export type ModelPrice = z.infer<typeof modelPriceSchema>;
export const modelPricingSchema = z.record(z.string(), modelPriceSchema);
export type ModelPricing = z.infer<typeof modelPricingSchema>;

export const DEFAULT_MODEL_PRICING: ModelPricing = {
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  'text-embedding-3-small': { inputPerMTok: 0.02 },
  'whisper-1': { perAudioMinute: 0.006 },
};

export function parseModelPricing(raw: string | undefined): ModelPricing {
  if (!raw?.trim()) return DEFAULT_MODEL_PRICING;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('AI_MODEL_PRICING must be valid JSON');
  }
  const parsed = modelPricingSchema.safeParse(json);
  if (!parsed.success) throw new Error(`AI_MODEL_PRICING is invalid: ${parsed.error.issues[0]?.message ?? 'bad shape'}`);
  return { ...DEFAULT_MODEL_PRICING, ...parsed.data };
}

/** Finds pricing for a model id, accepting dated snapshots such as claude-haiku-4-5-20251001. */
export function priceFor(pricing: ModelPricing, model: string): ModelPrice | null {
  if (pricing[model]) return pricing[model];
  const match = Object.keys(pricing)
    .filter((key) => model.startsWith(`${key}-`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? pricing[match]! : null;
}

/** Estimated cost in micro-dollars (1e-6 USD) so small calls do not round to zero; null when pricing is unknown. */
export function estimateCostMicros(pricing: ModelPricing, model: string, usage: { inputTokens?: number; outputTokens?: number; audioSeconds?: number }): number | null {
  const price = priceFor(pricing, model);
  if (!price) return null;
  let usd = 0;
  let priced = false;
  if (usage.inputTokens) {
    if (price.inputPerMTok === undefined) return null;
    usd += (usage.inputTokens / 1_000_000) * price.inputPerMTok;
    priced = true;
  }
  if (usage.outputTokens) {
    if (price.outputPerMTok === undefined) return null;
    usd += (usage.outputTokens / 1_000_000) * price.outputPerMTok;
    priced = true;
  }
  if (usage.audioSeconds) {
    if (price.perAudioMinute === undefined) return null;
    usd += (usage.audioSeconds / 60) * price.perAudioMinute;
    priced = true;
  }
  return priced ? Math.round(usd * 1_000_000) : 0;
}
