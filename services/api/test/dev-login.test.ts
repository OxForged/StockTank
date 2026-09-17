import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type PrismaClient } from '@stocktank/database';
import { authResponseSchema } from '@stocktank/types';
import { createApp } from '../src/app.js';
import { loadEnv, type ApiEnv } from '../src/env.js';
import { createLogger } from '../src/lib/logger.js';
import { CSRF_HEADERS, resetDb, seedUser, sessionCookie } from './helpers.js';

function appWith(env: ApiEnv, prisma: PrismaClient) {
  return createApp({ env, prisma, redis: null, logger: createLogger({ level: 'silent' }) });
}

describe('local dev staff login', () => {
  let prisma: PrismaClient;
  let baseEnv: ApiEnv;

  beforeAll(() => {
    baseEnv = loadEnv();
    prisma = createPrismaClient(baseEnv.DATABASE_URL);
  });
  beforeEach(async () => {
    await resetDb(prisma);
  });
  afterAll(async () => {
    await resetDb(prisma);
    await prisma.$disconnect();
  });

  it('is refused at boot when combined with NODE_ENV=production', () => {
    expect(() =>
      loadEnv({ ...process.env, NODE_ENV: 'production', DEV_LOGIN_ENABLED: 'true', SESSION_SECRET: 'x'.repeat(40) }),
    ).toThrow(/DEV_LOGIN_ENABLED must not be set in production/);
  });

  it('reports disabled and returns 404 when the flag is off', async () => {
    const app = appWith({ ...baseEnv, DEV_LOGIN_ENABLED: false }, prisma);
    await seedUser(prisma, { email: 'root@example.com', roles: ['super_admin'] });

    const status = await request(app).get('/api/v1/auth/dev-login');
    expect(status.body).toEqual({ enabled: false });

    const res = await request(app).post('/api/v1/auth/dev-login').set(CSRF_HEADERS);
    expect(res.status).toBe(404);
    expect(sessionCookie(res)).toBeNull();
  });

  it('signs a loopback client in as the super admin and audits it', async () => {
    const app = appWith({ ...baseEnv, DEV_LOGIN_ENABLED: true }, prisma);
    const admin = await seedUser(prisma, { email: 'root@example.com', roles: ['super_admin'] });
    await seedUser(prisma, { email: 'viewer@example.com', roles: ['viewer'] });

    const status = await request(app).get('/api/v1/auth/dev-login');
    expect(status.body).toEqual({ enabled: true });

    const res = await request(app).post('/api/v1/auth/dev-login').set(CSRF_HEADERS);
    expect(res.status).toBe(200);
    const body = authResponseSchema.parse(res.body);
    expect(body.user.id).toBe(admin.id);
    expect(body.user.roles).toContain('super_admin');

    const cookie = sessionCookie(res);
    expect(cookie).not.toBeNull();
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie!);
    expect(me.status).toBe(200);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'auth.dev_login', actorId: admin.id } });
    expect(audit).not.toBeNull();
  });

  it('still requires the CSRF header', async () => {
    const app = appWith({ ...baseEnv, DEV_LOGIN_ENABLED: true }, prisma);
    await seedUser(prisma, { email: 'root@example.com', roles: ['super_admin'] });
    const res = await request(app).post('/api/v1/auth/dev-login');
    expect(res.status).toBe(403);
  });
});
