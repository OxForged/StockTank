import type { RequestHandler } from 'express';
import { errors } from '../lib/errors.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Cookie-session CSRF defence for `/api/*`:
 *  - state-changing requests must carry an `X-Requested-With` header (browsers only add custom
 *    headers after a CORS preflight, which cross-site forms cannot pass);
 *  - when the browser sends an `Origin`, it must be one of the configured CORS origins.
 */
export function csrfProtection(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins.map(normaliseOrigin));
  return (req, _res, next) => {
    if (!STATE_CHANGING.has(req.method)) return next();

    const requestedWith = req.get('x-requested-with');
    if (!requestedWith || requestedWith.trim() === '') {
      return next(errors.forbidden('Missing X-Requested-With header'));
    }

    const origin = req.get('origin');
    if (origin !== undefined && origin !== 'null' && !allowed.has(normaliseOrigin(origin))) {
      return next(errors.forbidden('Origin not allowed'));
    }
    if (origin === 'null') return next(errors.forbidden('Origin not allowed'));

    next();
  };
}

function normaliseOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '').toLowerCase();
}
