import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema } from '@stocktank/types';
import { CSRF_HEADERS, PASSWORD, createTestContext, resetDb, seedUser, type TestContext } from './helpers.js';

describe('CSRF protection', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetDb(ctx.prisma);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'ada@example.com' });
  });
  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  const credentials = { email: 'ada@example.com', password: PASSWORD };

  it('rejects a state-changing request without X-Requested-With', async () => {
    const res = await request(ctx.app).post('/api/v1/auth/login').send(credentials);
    expect(res.status).toBe(403);
    const body = apiErrorSchema.parse(res.body);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toMatch(/X-Requested-With/);
  });

  it('rejects an Origin that is not in CORS_ORIGINS', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set(CSRF_HEADERS)
      .set('Origin', 'https://evil.example')
      .send(credentials);
    expect(res.status).toBe(403);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('FORBIDDEN');
  });

  it('accepts an allowed Origin with the header', async () => {
    const origin = ctx.env.CORS_ORIGINS[0];
    expect(origin).toBeTypeOf('string');
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set(CSRF_HEADERS)
      .set('Origin', origin ?? '')
      .send(credentials);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not apply to GET requests', async () => {
    const res = await request(ctx.app).get('/api/v1/auth/me').set('Origin', 'https://evil.example');
    expect(res.status).toBe(401); // reached the route; rejected by auth, not CSRF
  });
});
