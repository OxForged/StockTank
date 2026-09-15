import type { VercelRequest, VercelResponse } from '@vercel/node';

// Publishes a real post through Zernio. Body shape matches Zernio's
// createPost: { content, platforms: [{ platform, accountId }], publishNow }
// Docs: https://docs.zernio.com/ (Step 4: Schedule Your First Post)

const ZERNIO_BASE = 'https://zernio.com/api/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'not_configured', message: 'ZERNIO_API_KEY is not set' });
    return;
  }

  try {
    const zernioRes = await fetch(`${ZERNIO_BASE}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await zernioRes.json();
    if (!zernioRes.ok) {
      res.status(zernioRes.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', message: 'Could not reach Zernio' });
  }
}
