import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminPermissionListSchema, adminRoleListSchema, apiKeyListSchema, auditLogPageSchema, createdApiKeySchema } from '@stocktank/types';
import { sha256Hex } from '../src/lib/crypto.js';
import { CSRF_HEADERS, createTestContext, loginAs, resetDb, seedUser, type TestContext } from './helpers.js';

describe('system administration: audit log, roles, API keys', () => {
  let ctx: TestContext;
  let superAdmin: string;
  let admin: string;
  let editor: string;
  let editorId: string;

  const as = (cookie: string) => ({
    get: (url: string) => request(ctx.app).get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => request(ctx.app).post(url).set('Cookie', cookie).set(CSRF_HEADERS).send(body),
  });

  beforeAll(async () => {
    ctx = await createTestContext({ redis: false });
  });
  beforeEach(async () => {
    await ctx.prisma.apiKey.deleteMany({});
    await resetDb(ctx.prisma);
    await seedUser(ctx.prisma, { email: 'root@example.com', roles: ['super_admin'] });
    await seedUser(ctx.prisma, { email: 'admin@example.com', roles: ['admin'] });
    editorId = (await seedUser(ctx.prisma, { email: 'editor@example.com', roles: ['editor'] })).id;
    superAdmin = await loginAs(ctx.app, 'root@example.com');
    admin = await loginAs(ctx.app, 'admin@example.com');
    editor = await loginAs(ctx.app, 'editor@example.com');
  });
  afterAll(async () => {
    await ctx.prisma.apiKey.deleteMany({});
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  it('pages through the audit log with filters and a stable cursor', async () => {
    const base = new Date('2026-09-01T00:00:00Z').getTime();
    await ctx.prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({ action: i % 2 ? 'content.show.update' : 'advertising.campaign.approve', targetType: 'show', targetId: `t${i}`, createdAt: new Date(base + i * 1000), metadata: { i } })),
    });
    expect((await as(editor).get('/api/v1/admin/audit-logs')).status).toBe(403);

    const first = auditLogPageSchema.parse((await as(admin).get('/api/v1/admin/audit-logs?pageSize=2&action=content.show&from=2026-09-01T00:00:00.000Z')).body);
    expect(first.items.map((e) => e.targetId)).toEqual(['t3', 't1']);
    expect(first.nextCursor).toBeNull();

    const p1 = auditLogPageSchema.parse((await as(admin).get('/api/v1/admin/audit-logs?pageSize=2&targetType=show')).body);
    const p2 = auditLogPageSchema.parse((await as(admin).get(`/api/v1/admin/audit-logs?pageSize=2&targetType=show&cursor=${p1.nextCursor}`)).body);
    const p3 = auditLogPageSchema.parse((await as(admin).get(`/api/v1/admin/audit-logs?pageSize=2&targetType=show&cursor=${p2.nextCursor}`)).body);
    expect([...p1.items, ...p2.items, ...p3.items].map((e) => e.targetId)).toEqual(['t4', 't3', 't2', 't1', 't0']);
    expect(p3.nextCursor).toBeNull();
    expect((await as(admin).get('/api/v1/admin/audit-logs?cursor=garbage')).status).toBe(400);

    // Login events carry the actor.
    const logins = auditLogPageSchema.parse((await as(admin).get('/api/v1/admin/audit-logs?action=auth.login')).body);
    expect(logins.items.some((e) => e.actor?.email === 'editor@example.com')).toBe(true);
  });

  it('shows the role and permission catalogue to role managers only', async () => {
    expect((await as(admin).get('/api/v1/admin/roles')).status).toBe(403);
    const roles = adminRoleListSchema.parse((await as(superAdmin).get('/api/v1/admin/roles')).body);
    const editorRole = roles.items.find((r) => r.key === 'editor')!;
    expect(editorRole.permissions).toContain('analytics.read');
    expect(editorRole.permissions).not.toContain('users.manage');
    expect(editorRole.userCount).toBe(1);
    const perms = adminPermissionListSchema.parse((await as(superAdmin).get('/api/v1/admin/permissions')).body);
    const rolesManage = perms.items.find((p) => p.key === 'roles.manage')!;
    expect(rolesManage.roles).toEqual(['super_admin']);
    expect(rolesManage.userCount).toBe(1);
    expect(rolesManage.description).toMatch(/admin/i);
  });

  it('creates read-only, scoped API keys whose secret is shown once and stored hashed', async () => {
    expect((await as(editor).post('/api/v1/admin/api-keys', { name: 'x', scopes: ['content.read_drafts'] })).status).toBe(403);
    // Admins cannot grant scopes outside the allow-list.
    expect((await as(admin).post('/api/v1/admin/api-keys', { name: 'bad', scopes: ['users.manage'] })).status).toBe(400);

    const created = await as(admin).post('/api/v1/admin/api-keys', { name: 'Partner reporting', scopes: ['audit_logs.read', 'content.read_drafts'], expiresInDays: 30 });
    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    const { key, secret } = createdApiKeySchema.parse(created.body);
    expect(secret).toMatch(/^stk_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/);
    expect(secret.startsWith(key.prefix)).toBe(true);
    const row = await ctx.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(row.keyHash).toBe(sha256Hex(secret));
    expect(JSON.stringify(row)).not.toContain(secret);

    const bearer = (url: string) => request(ctx.app).get(url).set('Authorization', `Bearer ${secret}`);
    expect((await bearer('/api/v1/admin/audit-logs')).status).toBe(200);
    expect((await bearer('/api/v1/admin/content/shows')).status).toBe(200);
    // Not in scope even though the owner (admin) holds it.
    expect((await bearer('/api/v1/admin/users')).status).toBe(403);
    // Never usable for writes, even with CSRF headers.
    const write = await request(ctx.app).post('/api/v1/admin/api-keys').set('Authorization', `Bearer ${secret}`).set(CSRF_HEADERS).send({ name: 'nested', scopes: ['audit_logs.read'] });
    expect(write.status).toBe(403);
    expect(write.body.error.message).toMatch(/read-only/);

    expect((await ctx.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } })).lastUsedAt).not.toBeNull();

    const list = apiKeyListSchema.parse((await as(admin).get('/api/v1/admin/api-keys')).body);
    expect(list.items[0]).toMatchObject({ name: 'Partner reporting', owner: { email: 'admin@example.com' }, revokedAt: null });
    expect(JSON.stringify(list)).not.toContain(secret);

    expect((await as(admin).post(`/api/v1/admin/api-keys/${key.id}/revoke`)).status).toBe(200);
    expect((await as(admin).post(`/api/v1/admin/api-keys/${key.id}/revoke`)).status).toBe(409);
    const revoked = await bearer('/api/v1/admin/audit-logs');
    expect(revoked.status).toBe(401);

    const actions = (await ctx.prisma.auditLog.findMany({ where: { targetId: key.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(['api_key.create', 'api_key.revoke']);
  });

  it('narrows keys when the owner loses permissions and rejects expired or malformed keys', async () => {
    const editorAsAdmin = await ctx.prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
    await ctx.prisma.userRole.create({ data: { userId: editorId, roleId: editorAsAdmin.id } });
    const cookie = await loginAs(ctx.app, 'editor@example.com');
    const created = createdApiKeySchema.parse((await as(cookie).post('/api/v1/admin/api-keys', { name: 'mine', scopes: ['audit_logs.read'], expiresInDays: null })).body);
    const bearer = (url: string) => request(ctx.app).get(url).set('Authorization', `Bearer ${created.secret}`);
    expect((await bearer('/api/v1/admin/audit-logs')).status).toBe(200);

    await ctx.prisma.userRole.deleteMany({ where: { userId: editorId, roleId: editorAsAdmin.id } });
    expect((await bearer('/api/v1/admin/audit-logs')).status).toBe(403);

    await ctx.prisma.apiKey.update({ where: { id: created.key.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await bearer('/api/v1/admin/audit-logs')).status).toBe(401);

    // Other bearer tokens are not API keys and fall through to normal (unauthenticated) handling.
    expect((await request(ctx.app).get('/api/v1/admin/audit-logs').set('Authorization', 'Bearer not-a-key')).status).toBe(401);
  });
});
