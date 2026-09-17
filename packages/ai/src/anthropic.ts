import { z } from 'zod';
import { AIOutputError, AIProviderError, type GenerateOptions, type LLMProvider, type StreamEvent, type StructuredResult, type TextResult } from './types.js';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

interface AnthropicConfig {
  apiKey: string;
  defaultModel: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface MessageResponse {
  model: string;
  content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; name: string; input: unknown } | { type: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string | null;
}

/** Anthropic Messages API adapter (§18). Structured output uses a forced tool call validated with zod. */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel: string;
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: AnthropicConfig) {
    this.defaultModel = config.defaultModel;
    this.url = config.baseUrl ?? API;
    this.fetchImpl = config.fetch ?? fetch;
  }

  private body(options: GenerateOptions, extra: Record<string, unknown> = {}) {
    return {
      model: options.model ?? this.defaultModel,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.system ? { system: options.system } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      ...extra,
    };
  }

  private async post(body: unknown, signal?: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(this.config.timeoutMs ?? 120_000);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': VERSION },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      throw new AIProviderError(`Anthropic request failed: ${err instanceof Error ? err.message : 'network error'}`, this.name, 0, true);
    }
    if (!res.ok) {
      const detail = await res
        .json()
        .then((j) => (j as { error?: { message?: string } }).error?.message ?? '')
        .catch(() => '');
      // 429 rate limit, 529 overloaded and 5xx are worth retrying; 4xx input errors are not.
      const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
      throw new AIProviderError(`Anthropic API ${res.status}${detail ? `: ${detail}` : ''}`.slice(0, 500), this.name, res.status, retryable);
    }
    return res;
  }

  async generateText(options: GenerateOptions): Promise<TextResult> {
    const json = (await (await this.post(this.body(options), options.signal)).json()) as MessageResponse;
    const text = json.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('');
    return { text, model: json.model, usage: { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens }, stopReason: json.stop_reason };
  }

  async generateStructured<S extends z.ZodType>(
    options: GenerateOptions & { schema: S; schemaName: string; schemaDescription?: string },
  ): Promise<StructuredResult<z.infer<S>>> {
    const tool = {
      name: options.schemaName,
      description: options.schemaDescription ?? `Return the result as ${options.schemaName}.`,
      input_schema: z.toJSONSchema(options.schema, { target: 'draft-7' }),
    };
    const json = (await (
      await this.post(this.body(options, { tools: [tool], tool_choice: { type: 'tool', name: options.schemaName } }), options.signal)
    ).json()) as MessageResponse;
    const call = json.content.find((c): c is { type: 'tool_use'; name: string; input: unknown } => c.type === 'tool_use' && 'name' in c && c.name === options.schemaName);
    if (!call) throw new AIOutputError(`Anthropic did not return ${options.schemaName}`, this.name);
    const parsed = options.schema.safeParse(call.input);
    if (!parsed.success) throw new AIOutputError(`Anthropic output did not match ${options.schemaName}: ${parsed.error.issues[0]?.message ?? 'invalid'}`, this.name);
    return { data: parsed.data, model: json.model, usage: { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens } };
  }

  async *streamText(options: GenerateOptions): AsyncIterable<StreamEvent> {
    const res = await this.post(this.body(options, { stream: true }), options.signal);
    if (!res.body) throw new AIProviderError('Anthropic stream had no body', this.name, 0, true);
    let text = '';
    let model = options.model ?? this.defaultModel;
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let index: number;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (!data) continue;
        const event = JSON.parse(data) as {
          type: string;
          message?: { model: string; usage?: { input_tokens: number } };
          delta?: { type?: string; text?: string; stop_reason?: string };
          usage?: { output_tokens: number };
          error?: { message: string };
        };
        if (event.type === 'message_start' && event.message) {
          model = event.message.model;
          inputTokens = event.message.usage?.input_tokens ?? 0;
        } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          text += event.delta.text;
          yield { type: 'text', text: event.delta.text };
        } else if (event.type === 'message_delta') {
          stopReason = event.delta?.stop_reason ?? stopReason;
          outputTokens = event.usage?.output_tokens ?? outputTokens;
        } else if (event.type === 'error') {
          throw new AIProviderError(`Anthropic stream error: ${event.error?.message ?? 'unknown'}`, this.name, 0, true);
        }
      }
    }
    yield { type: 'done', result: { text, model, usage: { inputTokens, outputTokens }, stopReason } };
  }
}
