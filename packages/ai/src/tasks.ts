import { z } from 'zod';
import type { LLMProvider, StructuredResult, TextResult } from './types.js';

/**
 * README §18 methods that sit on top of any LLMProvider: summarize(), classify(), extractEntities().
 * Kept provider-neutral so swapping vendors never changes feature code.
 */

export const STOCKTANK_GUARDRAILS = [
  'You write for StockTank, a media network covering tokenized stocks and crypto.',
  'Content is informational and educational only. Never give personal investment advice, price predictions or return promises.',
  'Never invent facts, quotes, statistics, people or sources. If the provided material does not contain something, say it is not covered.',
  'Attribute claims to the provided sources. Keep company and project names exactly as given.',
].join('\n');

export async function summarize(provider: LLMProvider, text: string, options: { maxWords?: number; audience?: string; model?: string } = {}): Promise<TextResult> {
  return provider.generateText({
    model: options.model,
    system: `${STOCKTANK_GUARDRAILS}\nSummarise only what the text says.`,
    messages: [
      {
        role: 'user',
        content: `Summarise the following in at most ${options.maxWords ?? 120} words for ${options.audience ?? 'a general audience interested in markets'}.\n\n<text>\n${text}\n</text>`,
      },
    ],
    maxTokens: Math.ceil((options.maxWords ?? 120) * 2.5),
    temperature: 0.2,
  });
}

export async function classify<L extends string>(
  provider: LLMProvider,
  text: string,
  labels: readonly [L, ...L[]],
  options: { instructions?: string; model?: string } = {},
): Promise<StructuredResult<{ label: L; confidence: number; reason: string }>> {
  const schema = z.object({
    label: z.enum(labels),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(300),
  });
  return provider.generateStructured({
    model: options.model,
    system: STOCKTANK_GUARDRAILS,
    messages: [{ role: 'user', content: `${options.instructions ?? 'Classify the text.'}\nLabels: ${labels.join(', ')}\n\n<text>\n${text}\n</text>` }],
    schema,
    schemaName: 'classification',
    maxTokens: 400,
    temperature: 0,
  }) as Promise<StructuredResult<{ label: L; confidence: number; reason: string }>>;
}

export const extractedEntitiesSchema = z.object({
  companies: z.array(z.object({ name: z.string(), evidence: z.string().max(300) })).max(50),
  projects: z.array(z.object({ name: z.string(), symbol: z.string().nullable(), evidence: z.string().max(300) })).max(50),
  people: z.array(z.object({ name: z.string(), role: z.string().nullable(), evidence: z.string().max(300) })).max(50),
  topics: z.array(z.string()).max(20),
});
export type ExtractedEntities = z.infer<typeof extractedEntitiesSchema>;

/** Entities are only those explicitly named in the text; each carries the exact evidence phrase. */
export async function extractEntities(provider: LLMProvider, text: string, options: { model?: string } = {}): Promise<StructuredResult<ExtractedEntities>> {
  return provider.generateStructured({
    model: options.model,
    system: `${STOCKTANK_GUARDRAILS}\nOnly list entities explicitly named in the text. "evidence" must be copied verbatim from the text.`,
    messages: [{ role: 'user', content: `Extract companies, crypto/tokenization projects, people and topics.\n\n<text>\n${text}\n</text>` }],
    schema: extractedEntitiesSchema,
    schemaName: 'entities',
    maxTokens: 2000,
    temperature: 0,
  });
}

/** Drops entities whose evidence does not literally appear in the source text (models occasionally paraphrase). */
export function verifyEvidence(entities: ExtractedEntities, text: string): ExtractedEntities {
  const haystack = text.toLowerCase().replace(/\s+/g, ' ');
  const found = (evidence: string) => haystack.includes(evidence.toLowerCase().replace(/\s+/g, ' ').trim());
  return {
    companies: entities.companies.filter((e) => found(e.evidence)),
    projects: entities.projects.filter((e) => found(e.evidence)),
    people: entities.people.filter((e) => found(e.evidence)),
    topics: entities.topics,
  };
}
