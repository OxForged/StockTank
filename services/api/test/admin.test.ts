import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminUserListResponseSchema, apiErrorSchema } from '@stocktank/types';
import { CSRF_HEADERS, createTestContext, loginAs, resetDb, seedUser, type TestContext } from './helpers.js';

describe('admin users', () => {
  let ctx: TestContext;
  let viewerId: string;
  let adminId: string;
  let superAdminId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    viewerId = (await seedUser(ctx.prisma, { email: 'viewer@example.com', roles: ['viewer'] })).id;
    adminId = (await seedUser(ctx.prisma, { email: 'admin@example.com', roles: ['admin'] })).id;
    superAdminId = (await seedUser(ctx.prisma, { email: 'root@example.com', roles: ['super_admin'] })).id;
  });
  afterAll(async () => {
    await resetDb(ctx.prisma);
    await ctx.close();
  });

  describe('GET /api/v1/admin/users', () => {
    it('is 401 without a session', async () => {
      const res = await request(ctx.app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
    });

    it('is 403 FORBIDDEN for a viewer', async () => {
      const cookie = await loginAs(ctx.app, 'viewer@example.com');
      const res = await request(ctx.app).get('/api/v1/admin/users').set('Cookie', cookie);
      expect(res.status).toBe(403);
      const body = apiErrorSchema.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('users.read');
    });

    it('lists users with pagination for an admin', async () => {
      const cookie = await loginAs(ctx.app, 'admin@example.com');
      const res = await request(ctx.app).get('/api/v1/admin/users?page=1&pageSize=2').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const body = adminUserListResponseSchema.parse(res.body);
      expect(body.total).toBe(3);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.items).toHaveLength(2);

      const page2 = adminUserListResponseSchema.parse(
        (await request(ctx.app).get('/api/v1/admin/users?page=2&pageSize=2').set('Cookie', cookie)).body,
      );
      expect(page2.items).toHaveLength(1);
      const all = [...body.items, ...page2.items];
      expect(all.map((u) => u.email).sort()).toEqual(['admin@example.com', 'root@example.com', 'viewer@example.com']);
      expect(all.find((u) => u.email === 'admin@example.com')?.roles).toEqual(['admin']);
      expect(all.find((u) => u.email === 'admin@example.com')?.lastLoginAt).toBeTypeOf('string');
      expect(all.find((u) => u.email === 'viewer@example.com')?.lastLoginAt).toBeNull();
    });

    it('validates the pagination query', async () => {
      const cookie = await loginAs(ctx.app, 'admin@example.com');
      const res = await request(ctx.app).get('/api/v1/admin/users?page=0&pageSize=500').set('Cookie', cookie);
      expect(res.status).toBe(400);
      const body = apiErrorSchema.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect((body.error.details as { source: string }).source).toBe('query');
    });
  });

  describe('PUT /api/v1/admin/users/:id/roles', () => {
    it('lets an admin grant a non-privileged role and writes an audit row', async () => {
      const cookie = await loginAs(ctx.app, 'admin@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${viewerId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['viewer', 'editor'] });
      expect(res.status).toBe(204);

      const roles = await ctx.prisma.userRole.findMany({ where: { userId: viewerId }, include: { role: true } });
      expect(roles.map((r) => r.role.key).sort()).toEqual(['editor', 'viewer']);

      const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'user.roles.update' } });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(adminId);
      expect(audit?.targetType).toBe('user');
      expect(audit?.targetId).toBe(viewerId);
      expect(audit?.requestId).toBeTypeOf('string');
      expect(audit?.metadata).toMatchObject({ before: ['viewer'], after: ['editor', 'viewer'], added: ['editor'], removed: [] });
    });

    it('forbids an admin from granting super_admin (needs roles.manage)', async () => {
      const cookie = await loginAs(ctx.app, 'admin@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${viewerId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['viewer', 'super_admin'] });
      expect(res.status).toBe(403);
      const body = apiErrorSchema.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('roles.manage');

      const roles = await ctx.prisma.userRole.findMany({ where: { userId: viewerId }, include: { role: true } });
      expect(roles.map((r) => r.role.key)).toEqual(['viewer']);
      expect(await ctx.prisma.auditLog.count({ where: { action: 'user.roles.update' } })).toBe(0);
    });

    it('forbids an admin from revoking another admin', async () => {
      const cookie = await loginAs(ctx.app, 'admin@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${superAdminId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['viewer'] });
      expect(res.status).toBe(403);
    });

    it('lets a super_admin grant admin', async () => {
      const cookie = await loginAs(ctx.app, 'root@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${viewerId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['admin'] });
      expect(res.status).toBe(204);
      const roles = await ctx.prisma.userRole.findMany({ where: { userId: viewerId }, include: { role: true } });
      expect(roles.map((r) => r.role.key)).toEqual(['admin']);
    });

    it('refuses to remove the last super_admin', async () => {
      const cookie = await loginAs(ctx.app, 'root@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${superAdminId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['admin'] });
      expect(res.status).toBe(409);
      const body = apiErrorSchema.parse(res.body);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toMatch(/last super_admin/);

      const roles = await ctx.prisma.userRole.findMany({ where: { userId: superAdminId }, include: { role: true } });
      expect(roles.map((r) => r.role.key)).toEqual(['super_admin']);
    });

    it('allows removing a super_admin when another one remains', async () => {
      await seedUser(ctx.prisma, { email: 'root2@example.com', roles: ['super_admin'] });
      const cookie = await loginAs(ctx.app, 'root@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${superAdminId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['admin'] });
      expect(res.status).toBe(204);
    });

    it('is 404 for an unknown user and 400 for an invalid body', async () => {
      const cookie = await loginAs(ctx.app, 'root@example.com');
      const missing = await request(ctx.app)
        .put('/api/v1/admin/users/does-not-exist/roles')
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['viewer'] });
      expect(missing.status).toBe(404);
      expect(apiErrorSchema.parse(missing.body).error.code).toBe('NOT_FOUND');

      const invalid = await request(ctx.app)
        .put(`/api/v1/admin/users/${viewerId}/roles`)
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ roles: ['owner'] });
      expect(invalid.status).toBe(400);
      expect(apiErrorSchema.parse(invalid.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('is 403 without the X-Requested-With header', async () => {
      const cookie = await loginAs(ctx.app, 'root@example.com');
      const res = await request(ctx.app)
        .put(`/api/v1/admin/users/${viewerId}/roles`)
        .set('Cookie', cookie)
        .send({ roles: ['editor'] });
      expect(res.status).toBe(403);
    });
  });
});
