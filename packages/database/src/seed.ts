/**
 * Idempotent bootstrap seed: roles, permissions, feature flags and (optionally) the first super admin.
 * DEMO content is seeded separately in Milestone 2 and is always flagged `isDemo`.
 */
import path from 'node:path';
import { config } from 'dotenv';
import argon2 from 'argon2';
import { PERMISSIONS, roleKeySchema } from '@stocktank/types';
import { createPrismaClient } from './index.js';
import { FEATURE_FLAG_DEFINITIONS, ROLE_DEFINITIONS } from './rbac.js';
import { seedAdInventory } from './seed-inventory.js';

config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(url);

async function main() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const permissions = await prisma.permission.findMany();
  const permissionIds = new Map(permissions.map((p) => [p.key, p.id]));

  for (const roleKey of roleKeySchema.options) {
    const def = ROLE_DEFINITIONS[roleKey];
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: def.name, description: def.description },
      create: { key: roleKey, name: def.name, description: def.description },
    });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: def.permissions.map((p) => ({ roleId: role.id, permissionId: permissionIds.get(p)! })),
      }),
    ]);
  }

  for (const flag of FEATURE_FLAG_DEFINITIONS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: { key: flag.key, enabled: false, description: flag.description },
    });
  }

  await seedAdInventory(prisma, process.env.PUBLIC_WEB_URL ?? 'http://localhost:5190');

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Admin ${email} already exists; left unchanged`);
    } else {
      const superAdmin = await prisma.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
      await prisma.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
          profile: { create: { displayName: 'StockTank Admin' } },
          roles: { create: { roleId: superAdmin.id } },
        },
      });
      console.log(`Created super admin ${email}`);
    }
  }
  console.log('Seed complete: roles, permissions, feature flags, ad inventory, house campaigns');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
