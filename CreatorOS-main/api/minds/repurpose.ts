// ─────────────────────────────────────────────────────────────────────────────
// api/minds/repurpose.ts — Vercel serverless function for Minds Repurposing (v2 Prompts)
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMindsClient } from '@animocabrands/minds-client-lib';

const CONVERSATION_ALIAS = 'repurpose-main';
const REPLY_TIMEOUT_MS = 90_000;

class MindsNotConfiguredError extends Error {}

function getClient() {
  const key = process.env.MINDS_BUILDER_API_KEY;
  if (!key) {
    throw new MindsNotConfiguredError('MINDS_BUILDER_API_KEY is not set');
  }
  return createMindsClient({ builderApiKey: key });
}

async function getMindId(client: ReturnType<typeof createMindsClient>): Promise<string> {
  const minds = await client.listMinds();
  if (!minds || minds.length === 0) {
    throw new Error('No Minds found on your account at build.hellominds.ai');
  }
  return minds[0]!.mindId;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced && fenced[1] ? fenced[1] : text;
}

function extractJsonObject(rawText: string): string {
  const source = stripCodeFence(rawText);
  const start = source.indexOf('{');
  if (start === -1) {
    throw new Error(`The Minds Agent reply had no JSON object in it.`);
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return source.substring(start, i + 1);
    }
  }

  throw new Error(`The Minds Agent reply had an unterminated JSON object.`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { transcript, niche, angle } = req.body || {};

  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  try {
    const client = getClient();
    const mindId = await getMindId(client);
    await client.ensureConversation(CONVERSATION_ALIAS, mindId);

    const prompt = `SYSTEM:
You are the Content Agent inside CreatorOS, a Minds-native multi-agent creator management system. You repurpose raw creator content into platform-native drafts. You have access to this creator's long-term Minds memory (past posts, hook styles, engagement outcomes). You must ground every stylistic choice in that memory or explicitly say you didn't use it — never fabricate a memory reference.

CREATOR NICHE: ${niche || 'Tech & AI Creator'}
TARGET ANGLE: ${angle ? angle.toUpperCase() : 'CONTRARIAN'}
PLATFORM CONSTRAINTS:
- instagram: caption <=2,200 chars, hook in first 125 chars, 3-5 hashtags
- youtube_shorts: <=60s spoken script, hook in first 3s
- youtube_longform: chaptered outline with timestamps, 8-15 min pacing
- linkedin: <=3,000 chars, no emoji-heavy hooks, professional register
- twitter: <=280 chars per post, thread-able if needed

TRANSCRIPT:
${transcript}

INSTRUCTIONS:
1. Query memory for this creator's highest-performing ${angle || 'contrarian'} hooks. If none exist, set adapted_from_memory to false — do not guess.
2. Generate one draft per platform below, matching that platform's constraints exactly.
3. Do not include a virality score, engagement prediction, or any numeric confidence value in this response — that is the Analytics Agent's job, not yours.

Return ONLY valid JSON, no markdown fences, no commentary, matching this exact schema:
{
  "adapted_from_memory": boolean,
  "memory_insight": string,
  "drafts": {
    "instagram": string,
    "youtube_shorts": string,
    "youtube_longform": string,
    "linkedin": string,
    "twitter": string
  }
}`;

    await client.sendMessage({ alias: CONVERSATION_ALIAS, messageText: prompt });

    const outcome = await client.waitForReply({
      alias: CONVERSATION_ALIAS,
      timeoutMs: REPLY_TIMEOUT_MS,
    });

    if (outcome.timedOut) {
      return res.status(504).json({ error: 'Minds Agent response timed out.' });
    }

    const replyText = outcome.reply?.messageText || '';
    const jsonText = extractJsonObject(replyText);
    const result = JSON.parse(jsonText);

    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof MindsNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Minds API call failed' });
  }
}
