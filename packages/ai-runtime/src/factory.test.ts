import type { GenerateOptions, LLMProvider, StructuredResult } from '@stocktank/ai';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { clock, generateDraft, locateQuote, renderTranscript, type FactoryInput } from './factory.js';

const segments = [
  { start: 0, end: 4, text: 'Welcome to the Tank. Today we look at tokenized treasuries.', speaker: 'Anchor', confidence: 0.9 },
  { start: 4, end: 12, text: 'A tokenized treasury is a token that represents a claim on short-term government debt.', speaker: 'Analyst', confidence: 0.9 },
  { start: 12, end: 20, text: 'Redemptions may only run on business days, so around-the-clock trading does not mean instant cash.', speaker: 'Analyst', confidence: 0.85 },
  { start: 20, end: 26, text: 'Harbor Protocol partnered with Acme Custody this year.', speaker: 'Anchor', confidence: 0.9 },
];
const input: FactoryInput = {
  episode: { title: 'What is a tokenized treasury?', showTitle: 'AI Desk', number: 1, hosts: ['Anchor'], guests: [], companies: [{ id: 'c1', name: 'Acme Custody' }], projects: [{ id: 'p1', name: 'Harbor Protocol', symbol: 'HRBR' }] },
  transcript: { text: segments.map((s) => s.text).join(' '), segments, durationSeconds: 26 },
};

/** LLM stub that returns canned structured data per schemaName and records prompts. */
function stub(answers: Record<string, unknown>): LLMProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: 'stub',
    defaultModel: 'stub-1',
    prompts,
    generateText: () => Promise.reject(new Error('unused')),
    async *streamText() {
      yield { type: 'done', result: { text: '', model: 'stub-1', usage: { inputTokens: 0, outputTokens: 0 }, stopReason: null } };
    },
    generateStructured<S extends z.ZodType>(options: GenerateOptions & { schema: S; schemaName: string }): Promise<StructuredResult<z.infer<S>>> {
      prompts.push(`${options.system ?? ''}\n${options.messages.map((m) => m.content).join('\n')}`);
      const data = options.schema.parse(answers[options.schemaName]);
      return Promise.resolve({ data, model: 'stub-1', usage: { inputTokens: 100, outputTokens: 50 } });
    },
  };
}

describe('transcript helpers', () => {
  it('renders timestamped lines and trims long transcripts evenly', () => {
    const text = renderTranscript(segments);
    expect(text.split('\n')[1]).toBe('[0:04] Analyst: A tokenized treasury is a token that represents a claim on short-term government debt.');
    const long = Array.from({ length: 400 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `line ${i} ${'x'.repeat(100)}`, speaker: null, confidence: null }));
    const trimmed = renderTranscript(long, 5000);
    expect(trimmed.length).toBeLessThanOrEqual(5000);
    expect(trimmed).toContain('[0:00]');
    expect(clock(3725)).toBe('1:02:05');
  });

  it('locates verbatim quotes across segment boundaries and rejects invented ones', () => {
    expect(locateQuote(segments, 'Redemptions may only run on business days')).toEqual({ start: 12, end: 20, quote: 'Redemptions may only run on business days' });
    expect(locateQuote(segments, 'government debt. Redemptions may only')).toMatchObject({ start: 4, end: 20 });
    expect(locateQuote(segments, 'guaranteed 20% returns')).toBeNull();
  });
});

describe('generateDraft', () => {
  it('keeps only verbatim quotes and attaches citations', async () => {
    const llm = stub({
      quotes: {
        quotes: [
          { quote: 'A tokenized treasury is a token that represents a claim on short-term government debt.', speaker: 'Analyst', start: 0, end: 0, why: 'Definition' },
          { quote: 'Tokenized treasuries guarantee twenty percent returns forever.', speaker: 'Analyst', start: 4, end: 12, why: 'Invented' },
        ],
      },
    });
    const draft = await generateDraft('quotes', llm, input);
    expect(draft.content.quotes).toHaveLength(1);
    expect(draft.content.quotes[0]).toMatchObject({ start: 4, end: 12 });
    expect(draft.citations).toEqual([{ start: 4, end: 12, quote: 'A tokenized treasury is a token that represents a claim on short-term government debt.' }]);
    expect(draft.notes).toEqual(['1 quote(s) dropped: not found verbatim in the transcript']);
    expect(draft.moderationFlags).toEqual([]);
    expect(llm.prompts[0]).toContain('Never invent facts');
    expect(llm.prompts[0]).toContain('[0:12] Analyst:');
  });

  it('validates clip candidates against the transcript and replaces their text with real words', async () => {
    const llm = stub({
      clip_candidates: {
        candidates: [
          { title: 'Definition', start: 3, end: 21, targetSeconds: 30, reason: 'explanation', transcript: 'made up words', confidence: 0.8 },
          { title: 'Out of range', start: 20, end: 90, targetSeconds: 60, reason: 'humor', transcript: 'x', confidence: 0.5 },
          { title: 'Too short', start: 1, end: 5, targetSeconds: 30, reason: 'question', transcript: 'x', confidence: 0.5 },
        ],
      },
    });
    const draft = await generateDraft('clip_candidates', llm, input);
    expect(draft.content.candidates).toHaveLength(1);
    expect(draft.content.candidates[0]!.transcript).toContain('A tokenized treasury is a token');
    expect(draft.content.candidates[0]!.transcript).not.toContain('made up');
    expect(draft.notes[0]).toMatch(/2 candidate\(s\) dropped/);
  });

  it('matches entities to known ids and drops those without evidence, flagging risky text', async () => {
    const llm = stub({
      entities: {
        companies: [{ name: 'Acme Custody', evidence: 'partnered with Acme Custody', matchedCompanyId: null }, { name: 'BlackRock', evidence: 'BlackRock said', matchedCompanyId: null }],
        projects: [{ name: 'Harbor', symbol: 'HRBR', evidence: 'Harbor Protocol partnered', matchedProjectId: null }],
        people: [],
      },
      summary: { summary: 'The hosts explain tokenized treasuries and you should buy them today because they will hit $100.' },
    });
    const entities = await generateDraft('entities', llm, input);
    expect(entities.content.companies).toEqual([{ name: 'Acme Custody', evidence: 'partnered with Acme Custody', matchedCompanyId: 'c1' }]);
    expect(entities.content.projects[0]!.matchedProjectId).toBe('p1');
    expect(entities.notes[0]).toMatch(/1 entit/);

    const summary = await generateDraft('summary', llm, input);
    expect(summary.moderationFlags).toEqual(expect.arrayContaining(['investment_advice', 'price_prediction']));
  });
});
