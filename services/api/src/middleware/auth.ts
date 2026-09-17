import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '@stocktank/database';
import type { PermissionKey } from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import { errors } from '../lib/errors.js';
import { loadApiKey, readApiKey } from '../lib/api-keys.js';
import { clearSessionCookie, loadSession, readSessionToken } from '../lib/session.js';
import type { AuthContext } from '../types.js';

/**
 * Loads the session named by the `st_session` cookie (if any) and attaches `req.auth`.
 * Never rejects: routes decide with `requireAuth` / `requirePermission`.
 * A cookie that no longer maps to a live session is cleared so clients stop sending it.
 */
export function attachSession(prisma: PrismaClient, env: ApiEnv): RequestHandler {
  return async (req, res, next) => {
    const apiKey = readApiKey(req);
    if (apiKey) {
      try {
        const auth = await loadApiKey(prisma, apiKey);
        if (!auth) return next(errors.unauthenticated('Invalid, expired or revoked API key'));
        // Keys are read-only by design: a leaked key can never change data.
        if (req.method !== 'GET' && req.method !== 'HEAD') return next(errors.forbidden('API keys are read-only'));
        req.auth = auth;
        return next();
      } catch (err) {
        return next(err);
      }
    }
    const token = readSessionToken(req);
    if (!token) return next();
    try {
      const auth = await loadSession(prisma, token);
      if (auth) {
        req.auth = auth;
      } else {
        clearSessionCookie(res, env);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) return next(errors.unauthenticated());
  next();
}

/** Requires an authenticated user holding every listed permission. */
export function requirePermission(...keys: PermissionKey[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(errors.unauthenticated());
    const held = new Set(req.auth.permissions);
    const missing = keys.filter((k) => !held.has(k));
    if (missing.length > 0) {
      return next(errors.forbidden(`Missing permission: ${missing.join(', ')}`));
    }
    next();
  };
}

/** Narrowing helper for handlers mounted behind `requireAuth`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw errors.unauthenticated();
  return req.auth;
}
