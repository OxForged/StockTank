import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnthropicProvider } from './anthropic.js';
import { createAiProviders, EMBEDDING_DIMENSIONS } from './config.js';
import { DEFAULT_MODEL_PRICING, estimateCostMicros, parseModelPricing, priceFor } from './cost.js';
import { longestSharedWordRun, moderateText } from './moderation.js';
import { OpenAIEmbeddingProvider, OpenAIProvider, OpenAITranscriptionProvider } from './openai.js';
import { verifyEvidence } from './tasks.js';
import { AIOutputError, AIProviderError } from './types.js';

type Call = { url: string; init: RequestInit; body: unknown };

function fakeFetch(respond: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const raw = init?.body;
    const call: Call = { url: String(input), init: init ?? {}, body: typeof raw === 'string' ? JSON.parse(raw) : raw };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fetch: f, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('AnthropicProvider', () => {
  it('generates text with the Messages API contract', async () => {
    const { fetch, calls } = fakeFetch(() => json({ model: 'claude-sonnet-5', content: [{ type: 'text', text: 'Hello' }], usage: { input_tokens: 12, output_tokens: 3 }, stop_reason: 'end_turn' }));
    const p = new AnthropicProvider({ apiKey: 'sk-test', defaultModel: 'claude-sonnet-5', fetch });
    const r = await p.generateText({ system: 'Be brief', messages: [{ role: 'user', content: 'Hi' }], maxTokens: 50, temperature: 0 });
    expect(r).toEqual({ text: 'Hello', model: 'claude-sonnet-5', usage: { inputTokens: 12, outputTokens: 3 }, stopReason: 'end_turn' });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(calls[0]!.body).toEqual({ model: 'claude-sonnet-5', max_tokens: 50, system: 'Be brief', temperature: 0, messages: [{ role: 'user', content: 'Hi' }] });
  });

  it('forces a tool call for structured output and validates it', async () => {
    const schema = z.object({ label: z.enum(['news', 'opinion']), confidence: z.number() });
    const { fetch, calls } = fakeFetch(() =>
      json({ model: 'claude-haiku-4-5', content: [{ type: 'tool_use', name: 'classification', input: { label: 'news', confidence: 0.9 } }], usage: { input_tokens: 5, output_tokens: 5 }, stop_reason: 'tool_use' }),
    );
    const p = new AnthropicProvider({ apiKey: 'k', defaultModel: 'claude-haiku-4-5', fetch });
    const r = await p.generateStructured({ messages: [{ role: 'user', content: 'x' }], schema, schemaName: 'classification' });
    expect(r.data).toEqual({ label: 'news', confidence: 0.9 });
    const body = calls[0]!.body as { tool_choice: unknown; tools: Array<{ input_schema: { properties: object } }> };
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'classification' });
    expect(Object.keys(body.tools[0]!.input_schema.properties)).toEqual(['label', 'confidence']);

    const bad = fakeFetch(() => json({ model: 'm', content: [{ type: 'tool_use', name: 'classification', input: { label: 'rumor' } }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'tool_use' }));
    await expect(new AnthropicProvider({ apiKey: 'k', defaultModel: 'm', fetch: bad.fetch }).generateStructured({ messages: [], schema, schemaName: 'classification' })).rejects.toBeInstanceOf(AIOutputError);
  });

  it('parses the streaming event protocol', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"model":"claude-sonnet-5","usage":{"input_tokens":9}}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}',
      'event: message_stop\ndata: {"type":"message_stop"}',
    ].join('\n\n') + '\n\n';
    // Split mid-event to prove buffering works.
    const bytes = new TextEncoder().encode(sse);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(bytes.slice(0, 70));
        c.enqueue(bytes.slice(70));
        c.close();
      },
    });
    const { fetch, calls } = fakeFetch(() => new Response(stream, { status: 200 }));
    const p = new AnthropicProvider({ apiKey: 'k', defaultModel: 'claude-sonnet-5', fetch });
    const events = [];
    for await (const e of p.streamText({ messages: [{ role: 'user', content: 'Hi' }] })) events.push(e);
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text)).toEqual(['Hel', 'lo']);
    expect(events.at(-1)).toEqual({ type: 'done', result: { text: 'Hello', model: 'claude-sonnet-5', usage: { inputTokens: 9, outputTokens: 2 }, stopReason: 'end_turn' } });
    expect((calls[0]!.body as { stream: boolean }).stream).toBe(true);
  });

  it('marks overload and rate limits as retryable, bad requests as not', async () => {
    for (const [status, retryable] of [
      [529, true],
      [429, true],
      [400, false],
    ] as const) {
      const { fetch } = fakeFetch(() => json({ type: 'error', error: { type: 'x', message: 'nope' } }, status));
      const err = await new AnthropicProvider({ apiKey: 'k', defaultModel: 'm', fetch }).generateText({ messages: [] }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).retryable).toBe(retryable);
      expect((err as AIProviderError).message).toContain('nope');
    }
  });
});

describe('OpenAI adapters', () => {
  it('uses strict JSON schema output and validates it', async () => {
    const { fetch, calls } = fakeFetch(() => json({ model: 'gpt-4o-mini', choices: [{ message: { content: '{"topics":["rwa"]}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 4, completion_tokens: 6 } }));
    const p = new OpenAIProvider({ apiKey: 'k', fetch }, 'gpt-4o-mini');
    const r = await p.generateStructured({ system: 's', messages: [{ role: 'user', content: 'u' }], schema: z.object({ topics: z.array(z.string()) }), schemaName: 'topics' });
    expect(r).toEqual({ data: { topics: ['rwa'] }, model: 'gpt-4o-mini', usage: { inputTokens: 4, outputTokens: 6 } });
    const body = calls[0]!.body as { messages: Array<{ role: string }>; response_format: { type: string } };
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(body.response_format.type).toBe('json_schema');
  });

  it('checks embedding count and dimensions', async () => {
    const ok = fakeFetch(() => json({ data: [{ index: 1, embedding: [0, 1, 0] }, { index: 0, embedding: [1, 0, 0] }], usage: { prompt_tokens: 7 } }));
    const e = new OpenAIEmbeddingProvider({ apiKey: 'k', fetch: ok.fetch }, 'text-embedding-3-small', 3);
    expect(await e.embed(['a', 'b'])).toEqual({ vectors: [[1, 0, 0], [0, 1, 0]], usage: { inputTokens: 7 } });
    expect((ok.calls[0]!.body as { dimensions: number }).dimensions).toBe(3);
    const wrong = fakeFetch(() => json({ data: [{ index: 0, embedding: [1, 0] }], usage: { prompt_tokens: 1 } }));
    await expect(new OpenAIEmbeddingProvider({ apiKey: 'k', fetch: wrong.fetch }, 'm', 3).embed(['a'])).rejects.toBeInstanceOf(AIOutputError);
  });

  it('maps verbose transcription segments with confidence and reports no diarization', async () => {
    const { fetch, calls } = fakeFetch(() =>
      json({
        text: ' Welcome to the tank. ',
        language: 'english',
        duration: 12.5,
        segments: [
          { start: 0, end: 4.2, text: ' Welcome ', avg_logprob: -0.1 },
          { start: 4.2, end: 12.5, text: ' to the tank. ', avg_logprob: -0.3 },
        ],
      }),
    );
    const t = new OpenAITranscriptionProvider({ apiKey: 'k', fetch });
    const r = await t.transcribe(new Blob(['ID3']), 'ep.mp3');
    expect(t.supportsDiarization).toBe(false);
    expect(r).toMatchObject({ text: 'Welcome to the tank.', language: 'english', durationSeconds: 12.5, speakers: [], model: 'whisper-1' });
    expect(r.segments[0]).toEqual({ start: 0, end: 4.2, text: 'Welcome', speaker: null, confidence: 0.905 });
    expect(r.confidence).toBeCloseTo((0.905 + 0.741) / 2, 3);
    const form = calls[0]!.body as FormData;
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.getAll('timestamp_granularities[]')).toEqual(['segment']);
  });
});

describe('cost estimation', () => {
  it('prices known models, matches dated snapshots and refuses to guess unknown ones', () => {
    expect(priceFor(DEFAULT_MODEL_PRICING, 'claude-haiku-4-5-20251001')).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
    expect(estimateCostMicros(DEFAULT_MODEL_PRICING, 'claude-haiku-4-5', { inputTokens: 1_000_000, outputTokens: 200_000 })).toBe(2_000_000);
    expect(estimateCostMicros(DEFAULT_MODEL_PRICING, 'whisper-1', { audioSeconds: 600 })).toBe(60_000);
    expect(estimateCostMicros(DEFAULT_MODEL_PRICING, 'claude-sonnet-5', { inputTokens: 10 })).toBeNull();
    expect(estimateCostMicros(DEFAULT_MODEL_PRICING, 'text-embedding-3-small', { outputTokens: 10 })).toBeNull();
    const custom = parseModelPricing('{"claude-sonnet-5":{"inputPerMTok":3,"outputPerMTok":15}}');
    expect(estimateCostMicros(custom, 'claude-sonnet-5', { inputTokens: 1000, outputTokens: 1000 })).toBe(18_000);
    expect(() => parseModelPricing('{nope')).toThrow(/valid JSON/);
  });
});

describe('moderation', () => {
  it('flags advice, guarantees, predictions, impersonation and unsourced statistics', () => {
    const r = moderateText('You should buy HRBR today. It is guaranteed to deliver returns and will hit $10 by June. Volume rose 340% last week. Revenue grew 12% [1].');
    expect(r.flags).toEqual(expect.arrayContaining(['investment_advice', 'guaranteed_returns', 'price_prediction', 'unsourced_statistic']));
    expect(r.unsourcedStatistics.join(' ')).toContain('340%');
    expect(r.unsourcedStatistics.join(' ')).not.toContain('12% [1]');
    expect(moderateText('As Vitalik Buterin, I can confirm this.').flags).toContain('impersonation');
    expect(moderateText('Never share your seed phrase with anyone who asks you to send it.').flags).toContain('unsafe_content');
    expect(moderateText('Tokenized treasuries hold short-dated government debt on-chain.').flags).toEqual([]);
  });

  it('detects long verbatim overlap with sources', () => {
    const source = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    expect(longestSharedWordRun(`intro ${source} outro`, source)).toBe(60);
    expect(moderateText(`Summary: ${source}`, { sources: [source] }).flags).toContain('possible_copyright');
    expect(moderateText('A short original summary.', { sources: [source] }).flags).not.toContain('possible_copyright');
  });

  it('keeps only entities whose evidence appears in the text', () => {
    const text = 'Harbor Protocol partnered with Acme Custody on tokenized treasuries.';
    const verified = verifyEvidence(
      {
        companies: [{ name: 'Acme Custody', evidence: 'Acme  Custody' }, { name: 'BlackRock', evidence: 'BlackRock invested' }],
        projects: [{ name: 'Harbor', symbol: null, evidence: 'Harbor Protocol partnered' }],
        people: [],
        topics: ['rwa'],
      },
      text,
    );
    expect(verified.companies.map((c) => c.name)).toEqual(['Acme Custody']);
    expect(verified.projects).toHaveLength(1);
  });
});

describe('provider configuration', () => {
  it('prefers Anthropic, leaves features off without keys, and fixes embedding dimensions', () => {
    const none = createAiProviders({ AI_EMBEDDING_MODEL: 'text-embedding-3-small', AI_TRANSCRIPTION_MODEL: 'whisper-1' });
    expect(none).toMatchObject({ llm: null, fastLlm: null, embeddings: null, transcription: null });

    const both = createAiProviders({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', AI_EMBEDDING_MODEL: 'text-embedding-3-small', AI_TRANSCRIPTION_MODEL: 'whisper-1' });
    expect(both.llm?.name).toBe('anthropic');
    expect(both.llm?.defaultModel).toBe('claude-sonnet-5');
    expect(both.fastLlm?.defaultModel).toBe('claude-haiku-4-5');
    expect(both.embeddings?.dimensions).toBe(EMBEDDING_DIMENSIONS);
    expect(both.transcription?.name).toBe('openai');

    const openaiOnly = createAiProviders({ OPENAI_API_KEY: 'o', AI_LLM_MODEL: 'gpt-4.1', AI_EMBEDDING_MODEL: 'e', AI_TRANSCRIPTION_MODEL: 't' });
    expect(openaiOnly.llm?.name).toBe('openai');
    expect(openaiOnly.llm?.defaultModel).toBe('gpt-4.1');
  });
});
