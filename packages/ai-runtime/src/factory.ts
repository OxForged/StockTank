import { moderateText, STOCKTANK_GUARDRAILS, type LLMProvider, type ModerationFlag, type StructuredResult, type TranscriptSegment } from '@stocktank/ai';
import type { z } from 'zod';
import { AI_DRAFT_CONTENT_SCHEMAS, type AiDraftContent, type AiDraftKind, type Citation } from '@stocktank/types';

/**
 * Content factory (§20): turns an approved transcript into review-queue drafts. Generators never invent:
 * quotes and clip candidates are checked against the transcript, timestamps must fall inside it, and every
 * draft carries citations and moderation flags for the human reviewer.
 */

export const FACTORY_PROMPT_VERSION = '2026-09-17.1';

export interface EpisodeContext {
  title: string;
  showTitle: string;
  number: number | null;
  hosts: string[];
  guests: string[];
  /** Known entities to match against (name → id). */
  companies: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; symbol: string | null }>;
}

export interface FactoryInput {
  episode: EpisodeContext;
  transcript: { text: string; segments: TranscriptSegment[]; durationSeconds: number | null };
}

export interface FactoryDraft<K extends AiDraftKind = AiDraftKind> {
  kind: K;
  content: AiDraftContent<K>;
  citations: Citation[];
  moderationFlags: ModerationFlag[];
  model: string;
  provider: string;
  usage: { inputTokens: number; outputTokens: number };
  /** Generator notes for the reviewer, e.g. items dropped because they were not verbatim. */
  notes: string[];
}

const MAX_TRANSCRIPT_CHARS = 60_000;

/** Timestamped transcript for the model: `[mm:ss] Speaker: text`. Long transcripts are trimmed evenly. */
export function renderTranscript(segments: TranscriptSegment[], maxChars = MAX_TRANSCRIPT_CHARS): string {
  const lines = segments.map((s) => `[${clock(s.start)}]${s.speaker ? ` ${s.speaker}:` : ''} ${s.text.trim()}`);
  let out = lines.join('\n');
  if (out.length <= maxChars) return out;
  // Keep every k-th line so timing coverage stays even.
  const keep = Math.max(1, Math.ceil(out.length / maxChars));
  out = lines.filter((_, i) => i % keep === 0).join('\n');
  return out.slice(0, maxChars);
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Finds the segment window that contains a verbatim quote; null when the quote is not in the transcript. */
export function locateQuote(segments: TranscriptSegment[], quote: string): Citation | null {
  const needle = normalize(quote);
  if (needle.length < 8) return null;
  // Tightest window wins: single segments first, then pairs, then triples of consecutive segments.
  for (let span = 1; span <= 3; span++) {
    for (let i = 0; i + span <= segments.length; i++) {
      const window = segments.slice(i, i + span);
      const text = window.map((w) => normalize(w.text)).join(' ');
      if (text.includes(needle)) return { start: window[0]!.start, end: window[window.length - 1]!.end, quote: quote.slice(0, 400) };
    }
  }
  return null;
}

function segmentsBetween(segments: TranscriptSegment[], start: number, end: number): TranscriptSegment[] {
  return segments.filter((s) => s.end > start && s.start < end);
}

type Generator<K extends AiDraftKind> = (llm: LLMProvider, input: FactoryInput, transcriptText: string) => Promise<FactoryDraft<K>>;

function base<K extends AiDraftKind>(kind: K, llm: LLMProvider, input: FactoryInput, transcriptText: string, instructions: string, maxTokens: number): Promise<StructuredResult<AiDraftContent<K>>> {
  const system = `${STOCKTANK_GUARDRAILS}\nYou are producing ${kind.replace('_', ' ')} for the StockTank episode "${input.episode.title}" from the show "${input.episode.showTitle}". Hosts: ${input.episode.hosts.join(', ') || 'unknown'}. Guests: ${input.episode.guests.join(', ') || 'none'}.\nUse only the transcript. Timestamps are [m:ss] markers; report times in seconds.`;
  return llm.generateStructured({
    system,
    messages: [{ role: 'user', content: `${instructions}\n\n<transcript>\n${transcriptText}\n</transcript>` }],
    schema: AI_DRAFT_CONTENT_SCHEMAS[kind] as unknown as z.ZodType<AiDraftContent<K>>,
    schemaName: kind,
    maxTokens,
    temperature: 0.3,
  });
}

function finish<K extends AiDraftKind>(kind: K, result: { data: AiDraftContent<K>; model: string; usage: { inputTokens: number; outputTokens: number } }, provider: string, citations: Citation[], texts: string[], notes: string[] = []): FactoryDraft<K> {
  const { flags } = moderateText(texts.join('\n\n'));
  return { kind, content: result.data, citations, moderationFlags: flags, model: result.model, provider, usage: result.usage, notes };
}

const generators: { [K in AiDraftKind]: Generator<K> } = {
  summary: async (llm, input, t) => {
    const r = await base('summary', llm, input, t, 'Write a neutral summary of at most 120 words for the episode page. No advice, no predictions.', 600);
    return finish('summary', r, llm.name, [], [r.data.summary]);
  },
  show_notes: async (llm, input, t) => {
    const r = await base('show_notes', llm, input, t, 'Write show notes (markdown allowed, 150–400 words) and up to 8 key points. Attribute claims to who said them.', 1800);
    return finish('show_notes', r, llm.name, [], [r.data.notes, ...r.data.keyPoints]);
  },
  seo: async (llm, input, t) => {
    const r = await base('seo', llm, input, t, 'Write an SEO title (max 70 chars, no clickbait), meta description (max 160 chars) and up to 10 keywords.', 400);
    return finish('seo', r, llm.name, [], [r.data.title, r.data.description]);
  },
  chapters: async (llm, input, t) => {
    const r = await base('chapters', llm, input, t, 'Propose 4–12 chapters with start time in seconds (must match a transcript timestamp region) and a short title.', 800);
    const duration = input.transcript.durationSeconds ?? Infinity;
    const notes: string[] = [];
    const chapters = r.data.chapters.filter((c) => c.start <= duration).sort((a, b) => a.start - b.start);
    if (chapters.length !== r.data.chapters.length) notes.push(`${r.data.chapters.length - chapters.length} chapter(s) dropped: start time beyond the episode`);
    if (chapters[0] && chapters[0].start > 0) chapters[0] = { ...chapters[0], start: 0 };
    return finish('chapters', { ...r, data: { chapters } }, llm.name, chapters.map((c) => ({ start: c.start, end: c.start, quote: c.title })), chapters.map((c) => c.title), notes);
  },
  quotes: async (llm, input, t) => {
    const r = await base('quotes', llm, input, t, 'Select up to 8 quotable passages copied VERBATIM from the transcript (20–60 words), with speaker, start and end seconds, and why each matters.', 1800);
    const kept: typeof r.data.quotes = [];
    const citations: Citation[] = [];
    let dropped = 0;
    for (const q of r.data.quotes) {
      const c = locateQuote(input.transcript.segments, q.quote);
      if (!c) {
        dropped++;
        continue;
      }
      kept.push({ ...q, start: c.start, end: c.end });
      citations.push(c);
    }
    return finish('quotes', { ...r, data: { quotes: kept } }, llm.name, citations, kept.map((q) => q.quote), dropped ? [`${dropped} quote(s) dropped: not found verbatim in the transcript`] : []);
  },
  clip_candidates: async (llm, input, t) => {
    const r = await base(
      'clip_candidates',
      llm,
      input,
      t,
      'Propose up to 10 clip candidates of 30, 60 or 90 seconds: strong statements, important moments, questions, safe-but-lively debate, high-information moments, clear explanations, humour. Give start and end seconds and the transcript text of the window. Never invent words.',
      3000,
    );
    const duration = input.transcript.durationSeconds ?? Infinity;
    const kept: typeof r.data.candidates = [];
    const citations: Citation[] = [];
    let dropped = 0;
    for (const c of r.data.candidates) {
      const length = c.end - c.start;
      if (!(c.start >= 0 && c.end <= duration && length >= 15 && length <= 120)) {
        dropped++;
        continue;
      }
      const window = segmentsBetween(input.transcript.segments, c.start, c.end);
      if (window.length === 0) {
        dropped++;
        continue;
      }
      // Replace the model's transcript with the real words for that window.
      const transcript = window.map((s) => s.text.trim()).join(' ').slice(0, 2000);
      kept.push({ ...c, transcript });
      citations.push({ start: c.start, end: c.end, quote: transcript.slice(0, 400) });
    }
    return finish('clip_candidates', { ...r, data: { candidates: kept } }, llm.name, citations, kept.map((c) => c.title), dropped ? [`${dropped} candidate(s) dropped: outside the transcript or an invalid length`] : []);
  },
  social_posts: async (llm, input, t) => {
    const r = await base('social_posts', llm, input, t, 'Draft one post each for X, LinkedIn and Instagram, plus a YouTube description. Plain language, no hype, no price talk, include that it is a StockTank episode.', 1600);
    return finish('social_posts', r, llm.name, [], r.data.posts.map((p) => p.text));
  },
  newsletter: async (llm, input, t) => {
    const r = await base('newsletter', llm, input, t, 'Draft a newsletter section: subject (max 90 chars), preheader, and a 150–300 word body that tells readers what they will learn. Markdown allowed.', 1600);
    return finish('newsletter', r, llm.name, [], [r.data.subject, r.data.body]);
  },
  article: async (llm, input, t) => {
    const r = await base('article', llm, input, t, 'Write an explainer article (500–900 words, markdown) based only on what was said, attributing views to speakers. Include a short summary.', 4000);
    return finish('article', r, llm.name, [], [r.data.title, r.data.summary, r.data.body]);
  },
  entities: async (llm, input, t) => {
    const r = await base('entities', llm, input, t, 'List companies, crypto/tokenization projects and people explicitly named. "evidence" must be copied verbatim. Leave matched ids null.', 2000);
    const haystack = normalize(input.transcript.text);
    const verify = <T extends { evidence: string }>(items: T[]) => items.filter((e) => haystack.includes(normalize(e.evidence)));
    const byName = (name: string) => normalize(name);
    const companies = verify(r.data.companies).map((c) => ({ ...c, matchedCompanyId: input.episode.companies.find((k) => byName(k.name) === byName(c.name))?.id ?? null }));
    const projects = verify(r.data.projects).map((p) => ({
      ...p,
      matchedProjectId: input.episode.projects.find((k) => byName(k.name) === byName(p.name) || (p.symbol && k.symbol && k.symbol.toUpperCase() === p.symbol.toUpperCase()))?.id ?? null,
    }));
    const people = verify(r.data.people);
    const dropped = r.data.companies.length + r.data.projects.length + r.data.people.length - companies.length - projects.length - people.length;
    return finish('entities', { ...r, data: { companies, projects, people } }, llm.name, [], [], dropped ? [`${dropped} entit(y/ies) dropped: evidence not found in the transcript`] : []);
  },
  topics: async (llm, input, t) => {
    const r = await base('topics', llm, input, t, 'Give 3–8 topics (short noun phrases) and up to 15 tags for discovery.', 400);
    return finish('topics', r, llm.name, [], [...r.data.topics, ...r.data.tags]);
  },
};

export async function generateDraft<K extends AiDraftKind>(kind: K, llm: LLMProvider, input: FactoryInput): Promise<FactoryDraft<K>> {
  const transcriptText = renderTranscript(input.transcript.segments);
  return generators[kind](llm, input, transcriptText) as Promise<FactoryDraft<K>>;
}
