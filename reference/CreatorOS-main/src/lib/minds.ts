// ─────────────────────────────────────────────────────────────────────────────
// src/lib/minds.ts — Frontend client library for real Minds Agent API calls
// ─────────────────────────────────────────────────────────────────────────────

export interface MindsRepurposeResult {
  adapted_from_memory?: boolean;
  memory_insight?: string;
  drafts: {
    instagram?: { hook: string; body: string; cta: string };
    youtube_shorts?: { hook: string; script: string; cta: string };
    youtube_longform?: { hook: string; body: string; cta: string };
    linkedin?: { hook: string; body: string; cta: string };
    twitter?: { hook: string; thread: string[]; cta: string };
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export class MindsNotConfiguredError extends Error {}

async function parseOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) {
    throw new MindsNotConfiguredError(data.error || 'MINDS_BUILDER_API_KEY is not configured yet');
  }
  if (!res.ok) {
    throw new Error(data.error || `Minds API request failed (${res.status})`);
  }
  return data;
}

export async function repurposeWithMinds(
  transcript: string,
  niche: string = 'Tech & AI Creator',
  angle: string = 'contrarian'
): Promise<MindsRepurposeResult> {
  const res = await fetch('/api/minds/repurpose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, niche, angle }),
  });
  return parseOrThrow(res);
}

export async function sendApprovalToMinds(
  platform: string,
  hookStyle: string,
  hook: string
): Promise<void> {
  const res = await fetch('/api/minds/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, hookStyle, hook }),
  });
  await parseOrThrow(res);
}

export async function fetchMindsMemory(): Promise<ConversationMessage[]> {
  const res = await fetch('/api/minds/memory');
  const data = await parseOrThrow(res);
  return data.messages || [];
}
