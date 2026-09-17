import type { Prisma } from '@stocktank/database';
import type { AdminUser, CurrentUser } from '@stocktank/types';
import { resolveAccess } from './session.js';
import type { AuthContext } from '../types.js';

export function toCurrentUser(auth: AuthContext): CurrentUser {
  return {
    id: auth.user.id,
    email: auth.user.email,
    displayName: auth.user.displayName,
    avatarUrl: auth.user.avatarUrl,
    roles: auth.roles,
    permissions: auth.permissions,
    createdAt: auth.user.createdAt.toISOString(),
  };
}

export const adminUserInclude = {
  profile: true,
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

type AdminUserRow = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;

export function toAdminUser(user: AdminUserRow): AdminUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? '',
    status: user.status,
    roles: resolveAccess(user).roles,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
