import { Router } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@stocktank/database';
import {
  paginationQuerySchema,
  updateUserRolesRequestSchema,
  type AdminUserListResponse,
  type RoleKey,
} from '@stocktank/types';
import { writeAudit } from '../lib/audit.js';
import { errors } from '../lib/errors.js';
import { adminUserInclude, toAdminUser } from '../lib/users.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';

export interface AdminDeps {
  prisma: PrismaClient;
}

/** Granting or revoking these roles additionally requires `roles.manage`. */
const PRIVILEGED_ROLES: ReadonlySet<RoleKey> = new Set<RoleKey>(['super_admin', 'admin']);

export const userIdParamsSchema = z.object({ id: z.string().min(1).max(64) });

export function adminRouter({ prisma }: AdminDeps): Router {
  const router = Router();

  router.get('/users', requirePermission('users.read'), async (req, res) => {
    const { page, pageSize } = validate(paginationQuerySchema, req.query, 'query');
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        include: adminUserInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);
    const response: AdminUserListResponse = { items: rows.map(toAdminUser), page, pageSize, total };
    res.json(response);
  });

  router.put('/users/:id/roles', requirePermission('users.manage'), async (req, res) => {
    const actor = getAuth(req);
    const { id } = validate(userIdParamsSchema, req.params, 'params');
    const body = validate(updateUserRolesRequestSchema, req.body, 'body');
    const desired = new Set<RoleKey>(body.roles);
    const canManagePrivileged = actor.permissions.includes('roles.manage');

    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          include: { roles: { include: { role: { select: { key: true } } } } },
        });
        if (!target) throw errors.notFound('User not found');

        const current = new Set(target.roles.map((r) => r.role.key));
        const added = [...desired].filter((k) => !current.has(k));
        const removed = [...current].filter((k) => !desired.has(k as RoleKey));
        if (added.length === 0 && removed.length === 0) return;

        const privileged = [...added, ...removed].filter((k) => PRIVILEGED_ROLES.has(k as RoleKey));
        if (privileged.length > 0 && !canManagePrivileged) {
          throw errors.forbidden(`Permission roles.manage is required to grant or revoke: ${privileged.join(', ')}`);
        }

        if (removed.includes('super_admin')) {
          const superAdmins = await tx.userRole.count({ where: { role: { key: 'super_admin' } } });
          if (superAdmins <= 1) throw errors.conflict('Cannot remove the last super_admin');
        }

        const roleRows = await tx.role.findMany({ where: { key: { in: added } }, select: { id: true, key: true } });
        if (roleRows.length !== added.length) {
          const known = new Set(roleRows.map((r) => r.key));
          throw new Error(`Roles not seeded: ${added.filter((k) => !known.has(k)).join(', ')}`);
        }

        if (removed.length > 0) {
          await tx.userRole.deleteMany({ where: { userId: id, role: { key: { in: removed } } } });
        }
        if (roleRows.length > 0) {
          await tx.userRole.createMany({
            data: roleRows.map((r) => ({ userId: id, roleId: r.id })),
            skipDuplicates: true,
          });
        }

        await writeAudit(tx, req, {
          action: 'user.roles.update',
          actorId: actor.user.id,
          targetType: 'user',
          targetId: id,
          metadata: { before: [...current].sort(), after: [...desired].sort(), added, removed },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    res.status(204).end();
  });

  return router;
}
