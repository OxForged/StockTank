import { z } from 'zod';
import {
  AIOutputError,
  AIProviderError,
  type EmbeddingProvider,
  type GenerateOptions,
  type LLMProvider,
  type StreamEvent,
  type StructuredResult,
  type TextResult,
  type TranscriptionProvider,
  type TranscriptResult,
} from './types.js';

interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

class OpenAIClient {
  readonly base: string;
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly config: OpenAIConfig) {
    this.base = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.fetchImpl = config.fetch ?? fetch;
  }

  async post(path: string, body: unknown, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<Response> {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? this.config.timeoutMs ?? 120_000);
    const isForm = body instanceof FormData;
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.config.apiKey}`, ...(isForm ? {} : { 'content-type': 'application/json' }) },
        body: isForm ? body : JSON.stringify(body),
        signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });
    } catch (err) {
      throw new AIProviderError(`OpenAI request failed: ${err instanceof Error ? err.message : 'network error'}`, 'openai', 0, true);
    }
    if (!res.ok) {
      const detail = await res
        .json()
        .then((j) => (j as { error?: { message?: string } }).error?.message ?? '')
        .catch(() => '');
      throw new AIProviderError(`OpenAI API ${res.status}${detail ? `: ${detail}` : ''}`.slice(0, 500), 'openai', res.status, res.status === 429 || res.status >= 500);
    }
    return res;
  }
}

interface ChatResponse {
  model: string;
  choices: Array<{ message: { content: string | null; refusal?: string | null }; finish_reason: string | null }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/** OpenAI Chat Completions adapter (§18). Structured output uses strict JSON schema response format. */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client: OpenAIClient;

  constructor(
    config: OpenAIConfig,
    readonly defaultModel: string,
  ) {
    this.client = new OpenAIClient(config);
  }

  private messages(options: GenerateOptions) {
    return [...(options.system ? [{ role: 'system', content: options.system }] : []), ...options.messages];
  }

  async generateText(options: GenerateOptions): Promise<TextResult> {
    const json = (await (
      await this.client.post(
        '/chat/completions',
        { model: options.model ?? this.defaultModel, messages: this.messages(options), max_completion_tokens: options.maxTokens ?? 2048, ...(options.temperature !== undefined ? { temperature: options.temperature } : {}) },
        { signal: options.signal },
      )
    ).json()) as ChatResponse;
    const choice = json.choices[0];
    return { text: choice?.message.content ?? '', model: json.model, usage: { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }, stopReason: choice?.finish_reason ?? null };
  }

  async generateStructured<S extends z.ZodType>(options: GenerateOptions & { schema: S; schemaName: string; schemaDescription?: string }): Promise<StructuredResult<z.infer<S>>> {
    const json = (await (
      await this.client.post(
        '/chat/completions',
        {
          model: options.model ?? this.defaultModel,
          messages: this.messages(options),
          max_completion_tokens: options.maxTokens ?? 2048,
          response_format: { type: 'json_schema', json_schema: { name: options.schemaName, schema: z.toJSONSchema(options.schema, { target: 'draft-7' }) } },
        },
        { signal: options.signal },
      )
    ).json()) as ChatResponse;
    const message = json.choices[0]?.message;
    if (!message?.content) throw new AIOutputError(message?.refusal ? `OpenAI refused: ${message.refusal}` : `OpenAI did not return ${options.schemaName}`, this.name);
    let raw: unknown;
    try {
      raw = JSON.parse(message.content);
    } catch {
      throw new AIOutputError(`OpenAI returned invalid JSON for ${options.schemaName}`, this.name);
    }
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) throw new AIOutputError(`OpenAI output did not match ${options.schemaName}: ${parsed.error.issues[0]?.message ?? 'invalid'}`, this.name);
    return { data: parsed.data, model: json.model, usage: { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens } };
  }

  async *streamText(options: GenerateOptions): AsyncIterable<StreamEvent> {
    // Non-streaming fallback keeps the adapter simple; the interface still yields incrementally.
    const result = await this.generateText(options);
    if (result.text) yield { type: 'text', text: result.text };
    yield { type: 'done', result };
  }
}

/** OpenAI embeddings with a fixed dimension so vectors fit the database column. */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  private readonly client: OpenAIClient;

  constructor(
    config: OpenAIConfig,
    readonly model: string,
    readonly dimensions: number,
  ) {
    this.client = new OpenAIClient(config);
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; usage: { inputTokens: number } }> {
    if (texts.length === 0) return { vectors: [], usage: { inputTokens: 0 } };
    const json = (await (await this.client.post('/embeddings', { model: this.model, input: texts, dimensions: this.dimensions })).json()) as {
      data: Array<{ index: number; embedding: number[] }>;
      usage: { prompt_tokens: number };
    };
    const vectors = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (vectors.length !== texts.length || vectors.some((v) => v.length !== this.dimensions)) {
      throw new AIOutputError(`OpenAI embeddings did not return ${texts.length} vectors of ${this.dimensions} dimensions`, this.name);
    }
    return { vectors, usage: { inputTokens: json.usage.prompt_tokens } };
  }
}

interface VerboseTranscription {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string; avg_logprob?: number; no_speech_prob?: number }>;
}

/** Whisper-style transcription with segment timestamps (§15). No diarization, which the interface reports. */
export class OpenAITranscriptionProvider implements TranscriptionProvider {
  readonly name = 'openai';
  readonly supportsDiarization = false;
  private readonly client: OpenAIClient;

  constructor(
    config: OpenAIConfig,
    readonly model = 'whisper-1',
  ) {
    this.client = new OpenAIClient(config);
  }

  async transcribe(audio: Blob, filename: string, options: { language?: string } = {}): Promise<TranscriptResult> {
    const form = new FormData();
    form.set('file', audio, filename);
    form.set('model', this.model);
    form.set('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    if (options.language) form.set('language', options.language);
    const json = (await (await this.client.post('/audio/transcriptions', form, { timeoutMs: 30 * 60_000 })).json()) as VerboseTranscription;
    const segments = (json.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      speaker: null,
      // avg_logprob is a log probability per token; exp() maps it into 0–1.
      confidence: s.avg_logprob !== undefined ? Math.round(Math.exp(s.avg_logprob) * 1000) / 1000 : null,
    }));
    const scored = segments.filter((s) => s.confidence !== null);
    const confidence = scored.length ? Math.round((scored.reduce((sum, s) => sum + s.confidence!, 0) / scored.length) * 1000) / 1000 : null;
    return { text: json.text.trim(), language: json.language ?? null, durationSeconds: json.duration ?? null, segments, speakers: [], confidence, model: this.model };
  }

  async detectLanguage(audio: Blob, filename: string): Promise<string | null> {
    return (await this.transcribe(audio, filename)).language;
  }
}
