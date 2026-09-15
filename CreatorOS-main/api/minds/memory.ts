// ─────────────────────────────────────────────────────────────────────────────
// api/minds/memory.ts — Fetch real Minds Agent conversation history
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMindsClient } from '@animocabrands/minds-client-lib';

const CONVERSATION_ALIAS = 'repurpose-main';

function getClient() {
  const key = process.env.MINDS_BUILDER_API_KEY;
  if (!key) {
    throw new Error('not_configured: MINDS_BUILDER_API_KEY is not set');
  }
  return createMindsClient({ builderApiKey: key });
}

async function getMindId(client: ReturnType<typeof createMindsClient>): Promise<string> {
  const minds = await client.listMinds();
  if (!minds || minds.length === 0) {
    throw new Error('No Minds found');
  }
  return minds[0]!.mindId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const client = getClient();
    const mindId = await getMindId(client);
    await client.ensureConversation(CONVERSATION_ALIAS, mindId);

    const history = await client.getHistory(CONVERSATION_ALIAS);

    const messages = (history || []).map((msg) => ({
      role: (msg.senderType === 1 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (msg.messageText || '').substring(0, 500),
      timestamp: msg.createdAt,
    }));

    return res.status(200).json({ messages });
  } catch (err: any) {
    return res.status(200).json({ messages: [], error: err.message });
  }
}
