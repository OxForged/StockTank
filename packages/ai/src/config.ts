import { z } from 'zod';
import { AnthropicProvider } from './anthropic.js';
import { parseModelPricing, type ModelPricing } from './cost.js';
import { OpenAIEmbeddingProvider, OpenAIProvider, OpenAITranscriptionProvider } from './openai.js';
import type { EmbeddingProvider, LLMProvider, TranscriptionProvider } from './types.js';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const aiEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Which vendor generates text. Defaults to Anthropic when its key is set. */
  AI_LLM_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['anthropic', 'openai']).optional()),
  AI_LLM_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Cheaper model for high-volume tasks (classification, entity extraction). */
  AI_FAST_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AI_TRANSCRIPTION_MODEL: z.string().default('whisper-1'),
  AI_MODEL_PRICING: z.preprocess(emptyToUndefined, z.string().optional()),
});
export type AiEnv = z.infer<typeof aiEnvSchema>;

/** Vector column size in the database. Embedding providers must return exactly this many dimensions. */
export const EMBEDDING_DIMENSIONS = 1024;

export interface AiProviders {
  llm: LLMProvider | null;
  /** Same vendor as `llm`, configured with the fast model. */
  fastLlm: LLMProvider | null;
  embeddings: EmbeddingProvider | null;
  transcription: TranscriptionProvider | null;
  pricing: ModelPricing;
}

/** Builds providers from configuration. Missing keys leave features disabled (null) instead of failing at startup. */
export function createAiProviders(env: AiEnv, fetchImpl?: typeof fetch): AiProviders {
  const pricing = parseModelPricing(env.AI_MODEL_PRICING);
  const vendor = env.AI_LLM_PROVIDER ?? (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : null);
  let llm: LLMProvider | null = null;
  let fastLlm: LLMProvider | null = null;
  if (vendor === 'anthropic' && env.ANTHROPIC_API_KEY) {
    llm = new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, defaultModel: env.AI_LLM_MODEL ?? 'claude-sonnet-5', fetch: fetchImpl });
    fastLlm = new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, defaultModel: env.AI_FAST_MODEL ?? 'claude-haiku-4-5', fetch: fetchImpl });
  } else if (vendor === 'openai' && env.OPENAI_API_KEY) {
    llm = new OpenAIProvider({ apiKey: env.OPENAI_API_KEY, fetch: fetchImpl }, env.AI_LLM_MODEL ?? 'gpt-4o');
    fastLlm = new OpenAIProvider({ apiKey: env.OPENAI_API_KEY, fetch: fetchImpl }, env.AI_FAST_MODEL ?? 'gpt-4o-mini');
  }
  const openai = env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY, fetch: fetchImpl } : null;
  return {
    llm,
    fastLlm,
    embeddings: openai ? new OpenAIEmbeddingProvider(openai, env.AI_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS) : null,
    transcription: openai ? new OpenAITranscriptionProvider(openai, env.AI_TRANSCRIPTION_MODEL) : null,
    pricing,
  };
}
