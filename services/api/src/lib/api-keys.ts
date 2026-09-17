import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type { PrismaClient } from '@stocktank/database';
import { apiKeyScopeSchema, type PermissionKey } from '@stocktank/types';
import type { AuthContext } from '../types.js';
import { sha256Hex } from './crypto.js';
import { resolveAccess, userWithAccess } from './session.js';

/** Key format: `stk_<8 hex prefix>_<43 char base64url secret>`. Only the SHA-256 of the whole key is stored. */
const KEY_PATTERN = /^stk_([0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;
export const API_KEY_LAST_USED_INTERVAL_MS = 5 * 60 * 1000;

export function generateApiKey(): { secret: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString('hex');
  const secret = `stk_${prefix}_${randomBytes(32).toString('base64url')}`;
  return { secret, prefix, hash: sha256Hex(secret) };
}

/** Returns the bearer token when it looks like a StockTank API key; other Authorization schemes are ignored. */
export function readApiKey(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  return token && KEY_PATTERN.test(token) ? token : null;
}

/**
 * Resolves an API key to an auth context. Effective permissions are the key's scopes intersected with the
 * owner's *current* permissions, so demoting a user immediately narrows their keys.
 */
export async function loadApiKey(prisma: PrismaClient, token: string, now = new Date()): Promise<AuthContext | null> {
  const key = await prisma.apiKey.findUnique({ where: { keyHash: sha256Hex(token) }, include: { user: { include: userWithAccess } } });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= now) || key.user.status !== 'active') return null;

  const held = new Set(resolveAccess(key.user).permissions);
  const permissions = key.scopes
    .map((s) => apiKeyScopeSchema.safeParse(s))
    .filter((r) => r.success)
    .map((r) => r.data as PermissionKey)
    .filter((p) => held.has(p))
    .sort();

  if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > API_KEY_LAST_USED_INTERVAL_MS) {
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: now } }).catch(() => undefined);
  }

  return {
    user: {
      id: key.user.id,
      email: key.user.email,
      status: key.user.status,
      displayName: key.user.profile?.displayName ?? '',
      avatarUrl: key.user.profile?.avatarUrl ?? null,
      createdAt: key.user.createdAt,
    },
    roles: [],
    permissions,
    sessionId: `apikey:${key.id}`,
    apiKeyId: key.id,
  };
}
