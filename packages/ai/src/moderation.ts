/**
 * Deterministic moderation for AI drafts (§27, §56). These rules never approve anything: they add flags that a
 * human reviewer must acknowledge before an AI draft can be approved. They catch the high-risk patterns in
 * financial media; editors remain responsible for accuracy.
 */

export type ModerationFlag =
  | 'investment_advice'
  | 'guaranteed_returns'
  | 'price_prediction'
  | 'unsourced_statistic'
  | 'impersonation'
  | 'misleading_headline'
  | 'unsafe_content'
  | 'possible_copyright';

export const MODERATION_FLAG_LABELS: Record<ModerationFlag, string> = {
  investment_advice: 'Reads as personal investment advice',
  guaranteed_returns: 'Claims guaranteed or risk-free returns',
  price_prediction: 'Predicts prices or returns',
  unsourced_statistic: 'Contains statistics without a cited source',
  impersonation: 'Speaks as a real person or claims endorsement',
  misleading_headline: 'Sensational or misleading headline language',
  unsafe_content: 'Unsafe content',
  possible_copyright: 'Long passage that may be copied from a source',
};

const RULES: ReadonlyArray<{ flag: ModerationFlag; pattern: RegExp }> = [
  { flag: 'investment_advice', pattern: /\b(you should|we recommend|i recommend|consider) (buy|buying|sell|selling|invest(ing)? in|go(ing)? long|short(ing)?)\b|\b(buy|sell) (now|today|this dip)\b|\bstrong buy\b/i },
  { flag: 'guaranteed_returns', pattern: /\bguarantee(d|s)?\b[^.]{0,40}\b(return|profit|yield|gain|income)s?\b|\b(risk[-\s]?free|no[-\s]risk|can(?:'|no)?t lose)\b/i },
  { flag: 'price_prediction', pattern: /\b(will|is going to|set to) (hit|reach|double|triple|10x|100x|moon|explode|skyrocket|crash)\b|\bprice target of\b/i },
  { flag: 'impersonation', pattern: /\b(as|i am|i'm) (elon musk|vitalik buterin|michael saylor|cathie wood|gary gensler|the sec)\b|\bendorsed by (the sec|stocktank|blackrock)\b/i },
  { flag: 'misleading_headline', pattern: /\b(you won'?t believe|shocking|guaranteed to|this one trick|will make you rich|last chance)\b/i },
  { flag: 'unsafe_content', pattern: /\b(seed phrase|private key)\b[^.]{0,40}\b(send|share|enter|paste)\b|\b(send|share|enter|paste)\b[^.]{0,40}\b(seed phrase|private key)\b/i },
];

/** Numbers with %, $ or "x", or large counts, that are not followed by a [n] citation marker in the same sentence. */
const STAT = /(\$\s?\d[\d,.]*\s?(k|m|bn|b|million|billion|trillion)?|\b\d[\d,.]*\s?(%|percent|x\b)|\b\d{1,3}(,\d{3})+\b)/i;
const CITATION = /\[\d+\]|\(source:|according to/i;

export interface ModerationResult {
  flags: ModerationFlag[];
  /** Sentences that triggered unsourced_statistic, for the reviewer. */
  unsourcedStatistics: string[];
}

export function moderateText(text: string, options: { sources?: string[] } = {}): ModerationResult {
  const flags = new Set<ModerationFlag>();
  for (const rule of RULES) if (rule.pattern.test(text)) flags.add(rule.flag);

  const unsourcedStatistics = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => STAT.test(sentence) && !CITATION.test(sentence))
    .map((s) => s.trim())
    .slice(0, 10);
  if (unsourcedStatistics.length > 0) flags.add('unsourced_statistic');

  // Verbatim overlap with a source passage longer than ~40 words suggests copying rather than summarising.
  for (const source of options.sources ?? []) {
    if (longestSharedWordRun(text, source) >= 40) {
      flags.add('possible_copyright');
      break;
    }
  }
  return { flags: [...flags], unsourcedStatistics };
}

export function longestSharedWordRun(a: string, b: string): number {
  const words = (s: string) => s.toLowerCase().split(/\W+/).filter(Boolean);
  const wa = words(a);
  const wb = words(b);
  if (wa.length === 0 || wb.length === 0) return 0;
  // Index 8-word shingles of b, then extend matches from a.
  const K = 8;
  const shingles = new Map<string, number[]>();
  for (let i = 0; i + K <= wb.length; i++) {
    const key = wb.slice(i, i + K).join(' ');
    const list = shingles.get(key) ?? [];
    list.push(i);
    shingles.set(key, list);
  }
  let best = 0;
  for (let i = 0; i + K <= wa.length; i++) {
    for (const j of shingles.get(wa.slice(i, i + K).join(' ')) ?? []) {
      let len = K;
      while (i + len < wa.length && j + len < wb.length && wa[i + len] === wb[j + len]) len++;
      best = Math.max(best, len);
    }
  }
  return best;
}
