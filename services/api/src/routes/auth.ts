import { Router } from 'express';
import { Prisma, type PrismaClient } from '@stocktank/database';
import { loginRequestSchema, registerRequestSchema, type AuthResponse } from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import { writeAudit } from '../lib/audit.js';
import { getDummyPasswordHash, hashEmailForAudit, hashPassword, verifyPassword } from '../lib/crypto.js';
import { errors } from '../lib/errors.js';
import {
  clearSessionCookie,
  createSession,
  readSessionToken,
  revokeSessionById,
  revokeSessionByToken,
  setSessionCookie,
  toAuthContext,
  userWithAccess,
} from '../lib/session.js';
import { toCurrentUser } from '../lib/users.js';
import { validate } from '../lib/validate.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { loginRateLimiter, registerRateLimiter, type RateLimitConfig } from '../middleware/rate-limit.js';

export interface AuthDeps {
  env: ApiEnv;
  prisma: PrismaClient;
  rateLimits: RateLimitConfig;
}

const INVALID_CREDENTIALS = 'Invalid email or password';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Uses the TCP peer address (not X-Forwarded-For), so proxies cannot spoof it. */
function isLoopback(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK.has(address);
}

export function authRouter({ env, prisma, rateLimits }: AuthDeps): Router {
  const router = Router();

  router.post('/register', registerRateLimiter(rateLimits.register), async (req, res) => {
    const body = validate(registerRequestSchema, req.body, 'body');

    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) throw errors.conflict('An account with this email already exists');

    const viewerRole = await prisma.role.findUnique({ where: { key: 'viewer' }, select: { id: true } });
    if (!viewerRole) throw new Error('The "viewer" role is not seeded; run `pnpm db:seed`');

    const passwordHash = await hashPassword(body.password);
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash,
          profile: { create: { displayName: body.displayName } },
          roles: { create: { roleId: viewerRole.id } },
        },
        include: userWithAccess,
      });
    } catch (err) {
      // Unique-constraint race between the existence check and the insert.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw errors.conflict('An account with this email already exists');
      }
      throw err;
    }

    const { token, sessionId } = await createSession(prisma, env, req, user.id);
    await writeAudit(prisma, req, {
      action: 'auth.register',
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      metadata: { sessionId },
    });

    setSessionCookie(res, env, token);
    const response: AuthResponse = { user: toCurrentUser(toAuthContext(user, sessionId)) };
    res.status(201).json(response);
  });

  router.post('/login', loginRateLimiter(rateLimits.login), async (req, res) => {
    const body = validate(loginRequestSchema, req.body, 'body');
    const emailHash = hashEmailForAudit(body.email);

    const user = await prisma.user.findUnique({ where: { email: body.email }, include: userWithAccess });
    // Always run one argon2 verification so timing does not reveal whether the email exists.
    const hashToCheck = user?.passwordHash ?? (await getDummyPasswordHash());
    const passwordOk = await verifyPassword(hashToCheck, body.password);

    if (!user || !user.passwordHash || !passwordOk) {
      await writeAudit(prisma, req, {
        action: 'auth.login.failure',
        actorId: null,
        metadata: { emailHash, reason: 'invalid_credentials' },
      });
      throw errors.unauthenticated(INVALID_CREDENTIALS);
    }

    if (user.status !== 'active') {
      await writeAudit(prisma, req, {
        action: 'auth.login.failure',
        actorId: null,
        targetType: 'user',
        targetId: user.id,
        metadata: { emailHash, reason: 'suspended' },
      });
      throw errors.forbidden('This account is suspended');
    }

    // Rotate: a session cookie that arrived with the login request is retired.
    const previousToken = readSessionToken(req);
    if (previousToken) await revokeSessionByToken(prisma, previousToken);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const { token, sessionId } = await createSession(prisma, env, req, user.id);
    await writeAudit(prisma, req, {
      action: 'auth.login.success',
      actorId: user.id,
      targetType: 'session',
      targetId: sessionId,
      metadata: { rotatedPreviousSession: previousToken !== null },
    });

    setSessionCookie(res, env, token);
    const response: AuthResponse = { user: toCurrentUser(toAuthContext(user, sessionId)) };
    res.json(response);
  });

  router.post('/logout', requireAuth, async (req, res) => {
    const auth = getAuth(req);
    await revokeSessionById(prisma, auth.sessionId);
    await writeAudit(prisma, req, {
      action: 'auth.logout',
      actorId: auth.user.id,
      targetType: 'session',
      targetId: auth.sessionId,
    });
    clearSessionCookie(res, env);
    res.status(204).end();
  });

  /**
   * Local development shortcut: one-click sign-in as the seeded super admin.
   * Requires DEV_LOGIN_ENABLED=true (refused in production at boot) AND a loopback client.
   */
  router.get('/dev-login', (req, res) => {
    res.json({ enabled: env.DEV_LOGIN_ENABLED && isLoopback(req.socket.remoteAddress) });
  });

  router.post('/dev-login', async (req, res) => {
    if (!env.DEV_LOGIN_ENABLED || env.NODE_ENV === 'production' || !isLoopback(req.socket.remoteAddress)) {
      throw errors.notFound('Route not found');
    }
    const preferredEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const user =
      (preferredEmail
        ? await prisma.user.findFirst({
            where: { email: preferredEmail, status: 'active', roles: { some: { role: { key: 'super_admin' } } } },
            include: userWithAccess,
          })
        : null) ??
      (await prisma.user.findFirst({
        where: { status: 'active', roles: { some: { role: { key: 'super_admin' } } } },
        orderBy: { createdAt: 'asc' },
        include: userWithAccess,
      }));
    if (!user) throw errors.notFound('No active super admin exists; run `pnpm db:seed` with SEED_ADMIN_EMAIL set');

    const previousToken = readSessionToken(req);
    if (previousToken) await revokeSessionByToken(prisma, previousToken);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const { token, sessionId } = await createSession(prisma, env, req, user.id);
    await writeAudit(prisma, req, {
      action: 'auth.dev_login',
      actorId: user.id,
      targetType: 'session',
      targetId: sessionId,
      metadata: { warning: 'development shortcut' },
    });
    setSessionCookie(res, env, token);
    const response: AuthResponse = { user: toCurrentUser(toAuthContext(user, sessionId)) };
    res.json(response);
  });

  router.get('/me', requireAuth, (req, res) => {
    const response: AuthResponse = { user: toCurrentUser(getAuth(req)) };
    res.json(response);
  });

  return router;
}
