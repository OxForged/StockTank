import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, authResponseSchema } from '@stocktank/types';
import { sha256Hex } from '../src/lib/crypto.js';
import { SESSION_COOKIE } from '../src/lib/session.js';
import {
  CSRF_HEADERS,
  PASSWORD,
  createTestContext,
  loginAs,
  resetDb,
  seedUser,
  sessionCookie,
  sessionCookieAttributes,
  type TestContext,
} from './helpers.js';

const REGISTER = { email: 'Ada@Example.com', password: PASSWORD, displayName: 'Ada Lovelace' };

describe('auth', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  describe('register', () => {
    it('rejects an invalid body with VALIDATION_FAILED details', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .set(CSRF_HEADERS)
        .send({ email: 'not-an-email', password: 'short', displayName: 'A' });
      expect(res.status).toBe(400);
      const body = apiErrorSchema.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.requestId).toBeTypeOf('string');
      const details = body.error.details as { source: string; issues: Array<{ path: string }> };
      expect(details.source).toBe('body');
      expect(details.issues.map((i) => i.path).sort()).toEqual(['displayName', 'email', 'password']);
    });

    it('rejects a missing body', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/register').set(CSRF_HEADERS);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('creates the user, profile, viewer role and session', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/register').set(CSRF_HEADERS).send(REGISTER);
      expect(res.status).toBe(201);
      const { user } = authResponseSchema.parse(res.body);
      expect(user.email).toBe('ada@example.com');
      expect(user.displayName).toBe('Ada Lovelace');
      expect(user.roles).toEqual(['viewer']);
      expect(user.permissions).toEqual([]);

      const cookie = sessionCookieAttributes(res);
      expect(cookie).not.toBeNull();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Max-Age=\d+/);
      expect(cookie).not.toMatch(/Secure/); // NODE_ENV=test

      const dbUser = await ctx.prisma.user.findUniqueOrThrow({
        where: { email: 'ada@example.com' },
        include: { profile: true, roles: { include: { role: true } }, sessions: true },
      });
      expect(dbUser.passwordHash).toMatch(/^\$argon2id\$/);
      expect(dbUser.profile?.displayName).toBe('Ada Lovelace');
      expect(dbUser.roles.map((r) => r.role.key)).toEqual(['viewer']);
      expect(dbUser.sessions).toHaveLength(1);
      // Only a hash of the token is stored; the raw token never appears in the database.
      const rawToken = decodeURIComponent((sessionCookie(res) ?? '').slice(SESSION_COOKIE.length + 1)).replace(/^s:/, '').split('.')[0];
      expect(dbUser.sessions[0]?.tokenHash).toBe(sha256Hex(rawToken ?? ''));
      expect(dbUser.sessions[0]?.tokenHash).not.toBe(rawToken);
    });

    it('returns 409 CONFLICT for a duplicate email (case-insensitive)', async () => {
      await request(ctx.app).post('/api/v1/auth/register').set(CSRF_HEADERS).send(REGISTER);
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .set(CSRF_HEADERS)
        .send({ ...REGISTER, email: 'ADA@example.com' });
      expect(res.status).toBe(409);
      expect(apiErrorSchema.parse(res.body).error.code).toBe('CONFLICT');
    });
  });

  describe('login / me / logout', () => {
    beforeEach(async () => {
      await seedUser(ctx.prisma, { email: 'ada@example.com', displayName: 'Ada' });
    });

    it('sets the session cookie and updates lastLoginAt on success', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .send({ email: 'ada@example.com', password: PASSWORD });
      expect(res.status).toBe(200);
      expect(authResponseSchema.parse(res.body).user.email).toBe('ada@example.com');
      expect(sessionCookie(res)).not.toBeNull();
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
      expect(user.lastLoginAt).not.toBeNull();
    });

    it('returns a generic 401 for a wrong password and for an unknown email', async () => {
      const wrong = await request(ctx.app)
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .send({ email: 'ada@example.com', password: 'definitely-not-it' });
      const unknown = await request(ctx.app)
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .send({ email: 'nobody@example.com', password: 'definitely-not-it' });
      for (const res of [wrong, unknown]) {
        expect(res.status).toBe(401);
        const body = apiErrorSchema.parse(res.body);
        expect(body.error.code).toBe('UNAUTHENTICATED');
        expect(body.error.message).toBe('Invalid email or password');
        expect(sessionCookie(res)).toBeNull();
      }
    });

    it('returns 403 for a suspended user with the right password', async () => {
      await seedUser(ctx.prisma, { email: 'banned@example.com', status: 'suspended' });
      const res = await request(ctx.app)
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .send({ email: 'banned@example.com', password: PASSWORD });
      expect(res.status).toBe(403);
      expect(apiErrorSchema.parse(res.body).error.code).toBe('FORBIDDEN');
    });

    it('GET /me returns 401 without a cookie and the user with one', async () => {
      const anonymous = await request(ctx.app).get('/api/v1/auth/me');
      expect(anonymous.status).toBe(401);
      expect(apiErrorSchema.parse(anonymous.body).error.code).toBe('UNAUTHENTICATED');

      const cookie = await loginAs(ctx.app, 'ada@example.com');
      const me = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      const { user } = authResponseSchema.parse(me.body);
      expect(user.email).toBe('ada@example.com');
      expect(user.roles).toEqual(['viewer']);
    });

    it('ignores a forged or tampered cookie', async () => {
      const forged = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', `${SESSION_COOKIE}=s%3Anot-a-real-token.badsig`);
      expect(forged.status).toBe(401);
    });

    it('logout revokes the session, clears the cookie, and the cookie stops working', async () => {
      const cookie = await loginAs(ctx.app, 'ada@example.com');
      const logout = await request(ctx.app).post('/api/v1/auth/logout').set(CSRF_HEADERS).set('Cookie', cookie);
      expect(logout.status).toBe(204);
      expect(sessionCookieAttributes(logout)).toMatch(/Expires=Thu, 01 Jan 1970/);

      const after = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookie);
      expect(after.status).toBe(401);

      const sessions = await ctx.prisma.session.findMany();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.revokedAt).not.toBeNull();
    });

    it('logout without a session is 401', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/logout').set(CSRF_HEADERS);
      expect(res.status).toBe(401);
    });

    it('rotates: logging in with an existing cookie revokes the old session', async () => {
      const first = await loginAs(ctx.app, 'ada@example.com');
      const second = await request(ctx.app)
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .set('Cookie', first)
        .send({ email: 'ada@example.com', password: PASSWORD });
      expect(second.status).toBe(200);
      expect(sessionCookie(second)).not.toBe(first);

      const old = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', first);
      expect(old.status).toBe(401);
      const fresh = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', sessionCookie(second) ?? '');
      expect(fresh.status).toBe(200);
    });

    it('rejects an expired session', async () => {
      const cookie = await loginAs(ctx.app, 'ada@example.com');
      await ctx.prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookie);
      expect(res.status).toBe(401);
    });
  });

  describe('audit log', () => {
    it('records register, login success, login failure and logout without secrets', async () => {
      const reg = await request(ctx.app).post('/api/v1/auth/register').set(CSRF_HEADERS).send(REGISTER);
      const userId = reg.body.user.id as string;
      await request(ctx.app)
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .send({ email: 'ada@example.com', password: 'wrong-password-here' });
      const cookie = await loginAs(ctx.app, 'ada@example.com');
      await request(ctx.app).post('/api/v1/auth/logout').set(CSRF_HEADERS).set('Cookie', cookie);

      const rows = await ctx.prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
      expect(rows.map((r) => r.action)).toEqual(['auth.register', 'auth.login.failure', 'auth.login.success', 'auth.logout']);

      const [register, failure, success, logout] = rows;
      expect(register?.actorId).toBe(userId);
      expect(register?.targetId).toBe(userId);
      expect(failure?.actorId).toBeNull();
      expect(success?.actorId).toBe(userId);
      expect(logout?.actorId).toBe(userId);
      for (const row of rows) {
        expect(row.requestId).toBeTypeOf('string');
        expect(row.ipAddress).toBeTypeOf('string');
        const serialised = JSON.stringify(row.metadata ?? {});
        expect(serialised).not.toContain(PASSWORD);
        expect(serialised).not.toContain('wrong-password-here');
        expect(serialised).not.toContain('ada@example.com');
      }
      expect((failure?.metadata as { reason: string }).reason).toBe('invalid_credentials');
    });
  });
});
