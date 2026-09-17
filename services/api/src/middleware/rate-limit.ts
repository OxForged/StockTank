import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { errors } from '../lib/errors.js';

export interface RateLimitWindow {
  windowMs: number;
  limit: number;
}

export interface RateLimitConfig {
  /** All routes, per client IP. */
  global: RateLimitWindow;
  /** Failed login attempts, per IP + email. */
  login: RateLimitWindow;
  /** Registration attempts, per IP. */
  register: RateLimitWindow;
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  global: { windowMs: 60 * 1000, limit: 300 },
  login: { windowMs: 15 * 60 * 1000, limit: 10 },
  register: { windowMs: 15 * 60 * 1000, limit: 20 },
};

const shared: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(errors.rateLimited()),
};

export function globalRateLimiter(config: RateLimitWindow): RequestHandler {
  return rateLimit({
    ...shared,
    windowMs: config.windowMs,
    limit: config.limit,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  });
}

/** Strict limiter on login: only failed attempts count, keyed by IP and the submitted email. */
export function loginRateLimiter(config: RateLimitWindow): RequestHandler {
  return rateLimit({
    ...shared,
    windowMs: config.windowMs,
    limit: config.limit,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const body: unknown = req.body;
      const email =
        body && typeof body === 'object' && typeof (body as { email?: unknown }).email === 'string'
          ? (body as { email: string }).email.trim().toLowerCase()
          : '';
      return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
    },
  });
}

export function registerRateLimiter(config: RateLimitWindow): RequestHandler {
  return rateLimit({
    ...shared,
    windowMs: config.windowMs,
    limit: config.limit,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  });
}
