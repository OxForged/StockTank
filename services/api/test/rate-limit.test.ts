import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RATE_LIMITS,
  globalRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
} from '../src/middleware/rate-limit.js';

describe('rate limiter configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression: express-rate-limit rejects key generators that read req.ip without calling
  // ipKeyGenerator directly (IPv6 bypass). That check crashed `pnpm dev` at startup.
  it('builds every limiter without express-rate-limit validation errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => {
      globalRateLimiter(DEFAULT_RATE_LIMITS.global);
      loginRateLimiter(DEFAULT_RATE_LIMITS.login);
      registerRateLimiter(DEFAULT_RATE_LIMITS.register);
    }).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
