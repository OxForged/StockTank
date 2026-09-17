import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema } from '@stocktank/types';
import { CSRF_HEADERS, createTestContext, resetDb, seedUser, type TestContext } from './helpers.js';

describe('error envelope', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext({ rateLimits: { login: { windowMs: 60_000, limit: 2 } } });
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  it('returns a NOT_FOUND envelope with a requestId for unknown routes', async () => {
    const res = await request(ctx.app).get('/api/v1/nope').set('x-request-id', 'req-404');
    expect(res.status).toBe(404);
    const body = apiErrorSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe('req-404');
    expect(res.headers['x-request-id']).toBe('req-404');
  });

  it('returns BAD_REQUEST for malformed JSON', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set(CSRF_HEADERS)
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    const body = apiErrorSchema.parse(res.body);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('Malformed JSON body');
  });

  it('returns RATE_LIMITED after too many failed logins for one IP + email', async () => {
    await seedUser(ctx.prisma, { email: 'ada@example.com' });
    const attempt = (email: string) =>
      request(ctx.app).post('/api/v1/auth/login').set(CSRF_HEADERS).send({ email, password: 'wrong-password-1' });

    expect((await attempt('ada@example.com')).status).toBe(401);
    expect((await attempt('ada@example.com')).status).toBe(401);
    const limited = await attempt('ada@example.com');
    expect(limited.status).toBe(429);
    const body = apiErrorSchema.parse(limited.body);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.requestId).toBeTypeOf('string');

    // A different email from the same IP has its own budget.
    expect((await attempt('other@example.com')).status).toBe(401);
  });

  it('never includes a stack trace in the envelope for client errors', async () => {
    const res = await request(ctx.app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });
});
