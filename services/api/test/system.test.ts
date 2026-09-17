import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@stocktank/database';
import { healthResponseSchema, readyResponseSchema, versionResponseSchema } from '@stocktank/types';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { createTestContext, type TestContext } from './helpers.js';

describe('system routes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('GET /health returns ok', async () => {
    const res = await request(ctx.app).get('/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('GET /ready reports postgres and redis with latencies', async () => {
    const res = await request(ctx.app).get('/ready');
    expect(res.status).toBe(200);
    const body = readyResponseSchema.parse(res.body);
    expect(body.status).toBe('ready');
    expect(body.checks.postgres?.ok).toBe(true);
    expect(body.checks.postgres?.latencyMs).toBeTypeOf('number');
    if (ctx.env.REDIS_URL) {
      expect(body.checks.redis?.ok).toBe(true);
      expect(body.checks.redis?.latencyMs).toBeTypeOf('number');
    }
  });

  it('GET /ready returns 503 when a dependency is down', async () => {
    // Point a client at a port nothing listens on so `SELECT 1` fails fast.
    const deadUrl = new URL(ctx.env.DATABASE_URL);
    deadUrl.port = '1';
    const deadPrisma = createPrismaClient(deadUrl.toString());
    const app = createApp({ env: ctx.env, prisma: deadPrisma, logger: createLogger({ level: 'silent' }) });
    try {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      const body = readyResponseSchema.parse(res.body);
      expect(body.status).toBe('not_ready');
      expect(body.checks.postgres?.ok).toBe(false);
      expect(body.checks.postgres?.error).toBeTypeOf('string');
    } finally {
      await deadPrisma.$disconnect().catch(() => undefined);
    }
  });

  it('GET /version matches the contract', async () => {
    const res = await request(ctx.app).get('/version');
    expect(res.status).toBe(200);
    const body = versionResponseSchema.parse(res.body);
    expect(body.name).toBe('stocktank-api');
    expect(body.version).toBe(ctx.env.APP_VERSION);
    expect(body.node).toBe(process.version);
    expect(body.commit === null || typeof body.commit === 'string').toBe(true);
  });

  it('echoes an incoming x-request-id and generates one otherwise', async () => {
    const echoed = await request(ctx.app).get('/health').set('x-request-id', 'trace-abc-123');
    expect(echoed.headers['x-request-id']).toBe('trace-abc-123');

    const generated = await request(ctx.app).get('/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('serves the OpenAPI document with the cookie security scheme', async () => {
    const res = await request(ctx.app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.components.securitySchemes.cookieAuth).toMatchObject({ type: 'apiKey', in: 'cookie', name: 'st_session' });
    for (const p of ['/health', '/ready', '/version', '/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/me', '/api/v1/admin/users', '/api/v1/admin/users/{id}/roles']) {
      expect(res.body.paths).toHaveProperty(p);
    }
    expect(res.body.paths['/api/v1/auth/login'].post.responses['401'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/ApiError',
    );
  });
});
