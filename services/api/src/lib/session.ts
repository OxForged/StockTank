import type { CookieOptions, Request, Response } from 'express';
import type { Prisma, PrismaClient } from '@stocktank/database';
import { permissionKeySchema, roleKeySchema, type PermissionKey, type RoleKey } from '@stocktank/types';
import type { ApiEnv } from '../env.js';
import type { AuthContext } from '../types.js';
import { generateSessionToken, sha256Hex } from './crypto.js';

export const SESSION_COOKIE = 'st_session';
/** `lastSeenAt` is written at most this often per session. */
export const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

/** Include clause that loads everything needed to build an `AuthContext`. */
export const userWithAccess = {
  profile: true,
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccess }>;

export function cookieOptions(env: ApiEnv): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    signed: true,
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

export function setSessionCookie(res: Response, env: ApiEnv, token: string): void {
  res.cookie(SESSION_COOKIE, token, cookieOptions(env));
}

export function clearSessionCookie(res: Response, env: ApiEnv): void {
  // Same attributes as when set (so the browser matches the cookie), minus maxAge and signing:
  // clearing writes an empty value, and signing it would produce a stray "s:.<sig>" token.
  const { maxAge: _maxAge, signed: _signed, ...rest } = cookieOptions(env);
  res.clearCookie(SESSION_COOKIE, rest);
}

/** Reads the raw session token from the signed cookie, if one is present and its signature is valid. */
export function readSessionToken(req: Request): string | null {
  const signed: unknown = req.signedCookies?.[SESSION_COOKIE];
  return typeof signed === 'string' && signed.length > 0 ? signed : null;
}

export interface UserRolesShape {
  roles: Array<{ role: { key: string; permissions?: Array<{ permission: { key: string } }> } }>;
}

/** Resolves role and permission keys from a user's DB roles, ignoring keys unknown to the contracts. */
export function resolveAccess(user: UserRolesShape): { roles: RoleKey[]; permissions: PermissionKey[] } {
  const roles = new Set<RoleKey>();
  const permissions = new Set<PermissionKey>();
  for (const { role } of user.roles) {
    const roleKey = roleKeySchema.safeParse(role.key);
    if (roleKey.success) roles.add(roleKey.data);
    for (const { permission } of role.permissions ?? []) {
      const permissionKey = permissionKeySchema.safeParse(permission.key);
      if (permissionKey.success) permissions.add(permissionKey.data);
    }
  }
  return { roles: [...roles].sort(), permissions: [...permissions].sort() };
}

export function toAuthContext(user: UserWithAccess, sessionId: string): AuthContext {
  const access = resolveAccess(user);
  return {
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      displayName: user.profile?.displayName ?? '',
      avatarUrl: user.profile?.avatarUrl ?? null,
      createdAt: user.createdAt,
    },
    roles: access.roles,
    permissions: access.permissions,
    sessionId,
  };
}

export async function createSession(
  prisma: PrismaClient,
  env: ApiEnv,
  req: Request,
  userId: string,
): Promise<{ token: string; sessionId: string }> {
  const token = generateSessionToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256Hex(token),
      userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
      ipAddress: req.ip ?? null,
      expiresAt: new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  return { token, sessionId: session.id };
}

export async function revokeSessionByToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: sha256Hex(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSessionById(prisma: PrismaClient, sessionId: string): Promise<void> {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Loads the auth context for a raw session token. Returns null when the session is unknown,
 * revoked, expired, or belongs to a non-active user. Touches `lastSeenAt` at most every 5 minutes.
 */
export async function loadSession(prisma: PrismaClient, token: string): Promise<AuthContext | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: { include: userWithAccess } },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== 'active') return null;

  if (Date.now() - session.lastSeenAt.getTime() >= LAST_SEEN_UPDATE_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return toAuthContext(session.user, session.id);
}
