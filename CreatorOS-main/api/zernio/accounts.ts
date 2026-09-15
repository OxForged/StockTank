import type { VercelRequest, VercelResponse } from '@vercel/node';

// GET  -> list real connected accounts for this profile
// DELETE?accountId=... -> disconnect a real account
// Docs: https://docs.zernio.com/accounts/list-accounts, /accounts/delete-account

const ZERNIO_BASE = 'https://zernio.com/api/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'not_configured', message: 'ZERNIO_API_KEY is not set' });
    return;
  }

  try {
    if (req.method === 'DELETE') {
      const accountId = req.query.accountId;
      if (!accountId || typeof accountId !== 'string') {
        res.status(400).json({ error: 'bad_request', message: 'accountId query param is required' });
        return;
      }
      const zernioRes = await fetch(`${ZERNIO_BASE}/accounts/${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await zernioRes.json().catch(() => ({}));
      res.status(zernioRes.status).json(data);
      return;
    }

    const zernioRes = await fetch(`${ZERNIO_BASE}/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await zernioRes.json();
    if (!zernioRes.ok) {
      res.status(zernioRes.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', message: 'Could not reach Zernio', accounts: [] });
  }
}
