// ─────────────────────────────────────────────────────────────────────────────
// api/zernio/analytics.ts — Thin proxy for Zernio post analytics
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';

class ZernioNotConfiguredError extends Error {}

function getZernioConfig() {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new ZernioNotConfiguredError('ZERNIO_API_KEY is not set');
  }
  return { apiKey };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const postId = req.query.postId as string;

  try {
    const { apiKey } = getZernioConfig();
    const targetUrl = postId
      ? `https://zernio.com/api/v1/posts/${encodeURIComponent(postId)}/analytics`
      : `https://zernio.com/api/v1/analytics`;

    const zRes = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (zRes.status === 404 || zRes.status === 400) {
      return res.status(200).json({ views: 0, engagementRate: 0, postFound: false });
    }

    if (!zRes.ok) {
      return res.status(zRes.status).json({ error: `Zernio API error ${zRes.status}` });
    }

    const data = await zRes.json();
    return res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof ZernioNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Failed to fetch analytics' });
  }
}
