import type { Express } from 'express';
import type { Response } from 'supertest';
import request from 'supertest';
import { createPrismaClient, type PrismaClient } from '@stocktank/database';
import type { RoleKey } from '@stocktank/types';
import { createApp } from '../src/app.js';
import { loadEnv, type ApiEnv } from '../src/env.js';
import { hashPassword } from '../src/lib/crypto.js';
import { createLogger } from '../src/lib/logger.js';
import { createRedis } from '../src/lib/redis.js';
import { SESSION_COOKIE } from '../src/lib/session.js';
import type { RateLimitConfig } from '../src/middleware/rate-limit.js';

/** Header every state-changing request must carry (CSRF guard). */
export const CSRF_HEADERS = { 'X-Requested-With': 'vitest' } as const;

export const PASSWORD = 'correct horse battery staple';

export interface TestContext {
  app: Express;
  prisma: PrismaClient;
  env: ApiEnv;
  close(): Promise<void>;
}

export async function createTestContext(options: { rateLimits?: Partial<RateLimitConfig>; redis?: boolean } = {}): Promise<TestContext> {
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const logger = createLogger({ level: 'silent' });
  const redis = options.redis !== false && env.REDIS_URL ? createRedis(env.REDIS_URL, logger) : null;
  if (redis) await redis.connect();
  const app = createApp({ env, prisma, redis, logger, rateLimits: options.rateLimits });
  return {
    app,
    prisma,
    env,
    close: async () => {
      if (redis) await redis.quit();
      await prisma.$disconnect();
    },
  };
}

/** Removes users (cascading profiles, sessions, user_roles) and audit rows. Roles/permissions are kept. */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.auditLog.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

export interface SeedUserOptions {
  email: string;
  password?: string;
  displayName?: string;
  roles?: RoleKey[];
  status?: 'active' | 'suspended';
}

/** Inserts a user directly (bypassing the API) with the given roles. */
export async function seedUser(prisma: PrismaClient, options: SeedUserOptions): Promise<{ id: string; email: string }> {
  const roleKeys = options.roles ?? ['viewer'];
  const roles = await prisma.role.findMany({ where: { key: { in: roleKeys } }, select: { id: true } });
  if (roles.length !== roleKeys.length) throw new Error(`Roles not seeded: ${roleKeys.join(', ')}`);
  const user = await prisma.user.create({
    data: {
      email: options.email,
      passwordHash: await hashPassword(options.password ?? PASSWORD),
      status: options.status ?? 'active',
      profile: { create: { displayName: options.displayName ?? options.email.split('@')[0] ?? 'user' } },
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
    select: { id: true, email: true },
  });
  return user;
}

/** Extracts the `st_session` cookie (name=value) from a response, or null when absent. */
export function sessionCookie(res: Response): string | null {
  const header = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const pair = match.split(';')[0] ?? '';
  const value = pair.slice(SESSION_COOKIE.length + 1);
  return value === '' ? null : pair;
}

/** Full attributes of the session cookie, for asserting flags. */
export function sessionCookieAttributes(res: Response): string | null {
  const header = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? null;
}

/** Logs in through the API and returns the cookie pair to send on later requests. */
export async function loginAs(app: Express, email: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').set(CSRF_HEADERS).send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error('login did not set a session cookie');
  return cookie;
}
