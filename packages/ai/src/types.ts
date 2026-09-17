import type { z } from 'zod';

/** README §18: the application depends on these interfaces, never on one AI vendor. */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  system?: string;
  messages: ChatMessage[];
  /** Overrides the provider's default model. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Aborts long generations. */
  signal?: AbortSignal;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface TextResult {
  text: string;
  model: string;
  usage: Usage;
  stopReason: string | null;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: Usage;
}

export type StreamEvent = { type: 'text'; text: string } | { type: 'done'; result: TextResult };

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  generateText(options: GenerateOptions): Promise<TextResult>;
  /** Output is validated against `schema`; invalid output throws AIOutputError (never silently accepted). */
  generateStructured<S extends z.ZodType>(options: GenerateOptions & { schema: S; schemaName: string; schemaDescription?: string }): Promise<StructuredResult<z.infer<S>>>;
  streamText(options: GenerateOptions): AsyncIterable<StreamEvent>;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], kind: 'document' | 'query'): Promise<{ vectors: number[][]; usage: { inputTokens: number } }>;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker: string | null;
  /** 0–1, derived from the provider's token probabilities when available. */
  confidence: number | null;
}

export interface TranscriptResult {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  segments: TranscriptSegment[];
  speakers: string[];
  confidence: number | null;
  model: string;
}

/** README §15. Providers that cannot diarize say so via `supportsDiarization`. */
export interface TranscriptionProvider {
  readonly name: string;
  readonly model: string;
  readonly supportsDiarization: boolean;
  transcribe(audio: Blob, filename: string, options?: { language?: string; diarize?: boolean }): Promise<TranscriptResult>;
  detectLanguage(audio: Blob, filename: string): Promise<string | null>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status: number,
    /** True for rate limits, overload and network failures. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIOutputError extends Error {
  constructor(
    message: string,
    readonly provider: string,
  ) {
    super(message);
    this.name = 'AIOutputError';
  }
}
