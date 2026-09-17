import { z } from 'zod';

/** System roles. Permissions are attached to roles in the database. */
export const roleKeySchema = z.enum(['super_admin', 'admin', 'editor', 'sales', 'creator', 'viewer']);
export type RoleKey = z.infer<typeof roleKeySchema>;

export const PERMISSIONS = [
  'users.read',
  'users.manage',
  'roles.manage',
  'content.read_drafts',
  'content.write',
  'content.publish',
  'entities.write',
  'ai.review',
  'distribution.publish',
  'ads.manage',
  'ads.approve',
  'leads.manage',
  'newsletter.manage',
  'feature_flags.manage',
  'audit_logs.read',
  'api_keys.manage',
  'settings.manage',
] as const;
export const permissionKeySchema = z.enum(PERMISSIONS);
export type PermissionKey = z.infer<typeof permissionKeySchema>;

export const emailSchema = z.email().max(254).transform((e) => e.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(60),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  roles: z.array(roleKeySchema),
  permissions: z.array(permissionKeySchema),
  createdAt: z.string(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const authResponseSchema = z.object({ user: currentUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  status: z.enum(['active', 'suspended']),
  roles: z.array(roleKeySchema),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

export const updateUserRolesRequestSchema = z.object({ roles: z.array(roleKeySchema).min(1) });
export type UpdateUserRolesRequest = z.infer<typeof updateUserRolesRequestSchema>;
