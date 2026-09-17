import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@stocktank/database';
import type { z } from 'zod';
import type { healthResponseSchema, ReadyResponse, VersionResponse } from '@stocktank/types';
import type { ApiEnv } from '../env.js';

export interface SystemDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  redis: Redis | null;
}

type HealthResponse = z.infer<typeof healthResponseSchema>;

const CHECK_TIMEOUT_MS = 3_000;

type CheckResult = ReadyResponse['checks'][string];

async function timed(check: () => Promise<unknown>): Promise<CheckResult> {
  const started = performance.now();
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), CHECK_TIMEOUT_MS).unref()),
    ]);
    return { ok: true, latencyMs: round(performance.now() - started) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}

export function systemRouter({ env, prisma, redis }: SystemDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });

  router.get('/ready', async (_req, res) => {
    const checks: ReadyResponse['checks'] = {
      postgres: await timed(() => prisma.$queryRaw`SELECT 1`),
    };
    if (redis) {
      checks.redis = await timed(async () => {
        const reply = await redis.ping();
        if (reply !== 'PONG') throw new Error(`unexpected reply: ${reply}`);
      });
    }
    const ready = Object.values(checks).every((c) => c.ok);
    const body: ReadyResponse = { status: ready ? 'ready' : 'not_ready', checks };
    res.status(ready ? 200 : 503).json(body);
  });

  router.get('/version', (_req, res) => {
    const body: VersionResponse = {
      name: 'stocktank-api',
      version: env.APP_VERSION,
      commit: env.GIT_COMMIT,
      node: process.version,
    };
    res.json(body);
  });

  return router;
}
