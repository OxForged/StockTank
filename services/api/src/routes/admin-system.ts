import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@stocktank/database';
import { ROLE_DEFINITIONS, type PrismaClient } from '@stocktank/database';
import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  auditLogQuerySchema,
  createApiKeyInputSchema,
  roleKeySchema,
  type AdminPermission,
  type AdminRole,
  type ApiKeySummary,
  type AuditLogEntry,
  type AuditLogPage,
  type CreatedApiKey,
  type PermissionKey,
  type RoleKey,
} from '@stocktank/types';
import { generateApiKey } from '../lib/api-keys.js';
import { writeAudit } from '../lib/audit.js';
import { errors } from '../lib/errors.js';
import { validate } from '../lib/validate.js';
import { getAuth, requirePermission } from '../middleware/auth.js';

export interface AdminSystemDeps {
  prisma: PrismaClient;
}

const idParams = z.object({ id: z.string().min(1).max(64) });

/** Cursor = createdAt ISO + id, so pages stay stable while new rows arrive. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw errors.badRequest('Invalid cursor');
  return { createdAt, id };
}

/** System administration (§28): audit log, role and permission catalogue, API keys. */
export function adminSystemRouter({ prisma }: AdminSystemDeps): Router {
  const router = Router();

  // ───── Audit log ─────
  router.get('/audit-logs', requirePermission('audit_logs.read'), async (req, res) => {
    const q = validate(auditLogQuerySchema, req.query, 'query');
    const and: Prisma.AuditLogWhereInput[] = [];
    if (q.action) and.push({ action: { startsWith: q.action } });
    if (q.actorId) and.push({ actorId: q.actorId });
    if (q.targetType) and.push({ targetType: q.targetType });
    if (q.targetId) and.push({ targetId: q.targetId });
    if (q.from) and.push({ createdAt: { gte: new Date(q.from) } });
    if (q.to) and.push({ createdAt: { lte: new Date(q.to) } });
    if (q.cursor) {
      const c = decodeCursor(q.cursor);
      and.push({ OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] });
    }
    const rows = await prisma.auditLog.findMany({
      where: and.length ? { AND: and } : {},
      include: { actor: { select: { id: true, email: true, profile: { select: { displayName: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.pageSize + 1,
    });
    const page = rows.slice(0, q.pageSize);
    const items: AuditLogEntry[] = page.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor ? { id: r.actor.id, email: r.actor.email, displayName: r.actor.profile?.displayName ?? '' } : null,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata ?? null,
      ipAddress: r.ipAddress,
      requestId: r.requestId,
      createdAt: r.createdAt.toISOString(),
    }));
    const last = page.at(-1);
    const response: AuditLogPage = { items, nextCursor: rows.length > q.pageSize && last ? encodeCursor(last.createdAt, last.id) : null };
    res.json(response);
  });

  // ───── Roles & permissions (read-only: role definitions live in code and are applied by the seed) ─────
  const roleCatalogue = async () => {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
    });
    const byKey = new Map(roles.map((r) => [r.key, r]));
    return roleKeySchema.options.map((key): AdminRole => {
      const row = byKey.get(key);
      return {
        key,
        name: row?.name ?? ROLE_DEFINITIONS[key].name,
        description: row?.description ?? ROLE_DEFINITIONS[key].description,
        // What is actually in the database, so drift from code is visible.
        permissions: (row?.permissions.map((p) => p.permission.key) ?? []).filter((k): k is PermissionKey => (PERMISSIONS as readonly string[]).includes(k)).sort(),
        userCount: row?._count.users ?? 0,
      };
    });
  };

  router.get('/roles', requirePermission('roles.manage'), async (_req, res) => {
    res.json({ items: await roleCatalogue() });
  });

  router.get('/permissions', requirePermission('roles.manage'), async (_req, res) => {
    const roles = await roleCatalogue();
    const users = await prisma.user.findMany({
      where: { roles: { some: {} } },
      select: { roles: { select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } } } },
    });
    const items: AdminPermission[] = PERMISSIONS.map((key) => ({
      key,
      description: PERMISSION_DESCRIPTIONS[key],
      roles: roles.filter((r) => r.permissions.includes(key)).map((r) => r.key as RoleKey),
      userCount: users.filter((u) => u.roles.some((ur) => ur.role.permissions.some((rp) => rp.permission.key === key))).length,
    }));
    res.json({ items });
  });

  // ───── API keys ─────
  const keySelect = {
    id: true,
    name: true,
    prefix: true,
    scopes: true,
    lastUsedAt: true,
    expiresAt: true,
    revokedAt: true,
    createdAt: true,
    user: { select: { id: true, email: true } },
  } satisfies Prisma.ApiKeySelect;
  const toKey = (k: Prisma.ApiKeyGetPayload<{ select: typeof keySelect }>): ApiKeySummary => ({
    id: k.id,
    name: k.name,
    prefix: `stk_${k.prefix}`,
    scopes: k.scopes,
    owner: k.user,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  });
  const manage = requirePermission('api_keys.manage');

  router.get('/api-keys', manage, async (_req, res) => {
    const rows = await prisma.apiKey.findMany({ select: keySelect, orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }], take: 500 });
    res.json({ items: rows.map(toKey) });
  });

  router.post('/api-keys', manage, async (req, res) => {
    const auth = getAuth(req);
    if (auth.apiKeyId) throw errors.forbidden('API keys cannot create API keys');
    const body = validate(createApiKeyInputSchema, req.body, 'body');
    const missing = body.scopes.filter((s) => !auth.permissions.includes(s));
    if (missing.length > 0) throw errors.forbidden(`You can only grant scopes you hold: ${missing.join(', ')}`);
    const { secret, prefix, hash } = generateApiKey();
    const row = await prisma.apiKey.create({
      data: {
        userId: auth.user.id,
        name: body.name,
        prefix,
        keyHash: hash,
        scopes: [...new Set(body.scopes)].sort(),
        expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000) : null,
      },
      select: keySelect,
    });
    await writeAudit(prisma, req, { action: 'api_key.create', actorId: auth.user.id, targetType: 'api_key', targetId: row.id, metadata: { scopes: row.scopes, prefix } });
    const response: CreatedApiKey = { key: toKey(row), secret };
    res.set('Cache-Control', 'no-store');
    res.status(201).json(response);
  });

  router.post('/api-keys/:id/revoke', manage, async (req, res) => {
    const auth = getAuth(req);
    const { id } = validate(idParams, req.params, 'params');
    const updated = await prisma.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (updated.count === 0) {
      if (!(await prisma.apiKey.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('API key not found');
      throw errors.conflict('API key is already revoked');
    }
    await writeAudit(prisma, req, { action: 'api_key.revoke', actorId: auth.user.id, targetType: 'api_key', targetId: id });
    res.json(toKey(await prisma.apiKey.findUniqueOrThrow({ where: { id }, select: keySelect })));
  });

  return router;
}
