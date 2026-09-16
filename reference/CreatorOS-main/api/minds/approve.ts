// ─────────────────────────────────────────────────────────────────────────────
// api/minds/approve.ts — Send structured approval feedback to Minds memory thread (v2)
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMindsClient } from '@animocabrands/minds-client-lib';

const CONVERSATION_ALIAS = 'repurpose-main';

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
    throw new Error('No Minds found on your account');
  }
  return minds[0]!.mindId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { platform, hookStyle, hook, niche } = req.body || {};

  try {
    const client = getClient();
    const mindId = await getMindId(client);

    await client.ensureConversation(CONVERSATION_ALIAS, mindId);

    const feedbackMessage =
      `SYSTEM:\n` +
      `You are writing a structured memory-update event for CreatorOS's Minds memory store.\n\n` +
      `EVENT TYPE: draft_approved\n` +
      `PLATFORM: ${String(platform || 'instagram').toLowerCase()}\n` +
      `HOOK_STYLE: ${hookStyle || 'Contrarian'}\n` +
      `HOOK_TEXT: "${hook || ''}"\n` +
      `NICHE: ${niche || 'Tech & AI'}\n` +
      `TIMESTAMP: ${new Date().toISOString()}\n` +
      `ENGAGEMENT_AT_APPROVAL: unweighted — approval only, no engagement data yet\n\n` +
      `INSTRUCTIONS:\n` +
      `Store this as a discrete, retrievable memory entry — not a vague preference. ` +
      `Future Content Agent queries should be able to pull this exact hook as a reference example.`;

    await client.sendMessage({
      alias: CONVERSATION_ALIAS,
      messageText: feedbackMessage,
    });

    return res.status(200).json({ success: true, message: 'Structured memory entry recorded in Minds API' });
  } catch (err: any) {
    if (err instanceof MindsNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Minds approval feedback failed' });
  }
}
