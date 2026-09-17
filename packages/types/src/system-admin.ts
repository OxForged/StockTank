import { z } from 'zod';
import { permissionKeySchema, roleKeySchema, type PermissionKey } from './auth.js';

/** Human descriptions for the permission catalogue (§28 System → Permissions). */
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'users.read': 'View staff and audience accounts',
  'users.manage': 'Change user roles (admin roles also need roles.manage)',
  'roles.manage': 'Grant or revoke admin and super admin roles',
  'content.read_drafts': 'See unpublished shows, episodes, articles, media and clips',
  'content.write': 'Create and edit drafts, upload media, cut clips',
  'content.publish': 'Publish, archive or reject content; run the live schedule and radio',
  'entities.write': 'Edit project and company profiles',
  'ai.review': 'Approve AI-assisted output before it is published',
  'distribution.publish': 'Publish to podcast feeds, Castopod and social platforms',
  'ads.manage': 'Manage advertisers, campaigns, creatives and the rate card',
  'ads.approve': 'Approve or reject advertisers, campaigns and creatives',
  'leads.manage': 'Work advertising leads',
  'newsletter.manage': 'View and export newsletter subscribers',
  'feature_flags.manage': 'Turn feature flags on or off',
  'audit_logs.read': 'Read the audit log',
  'api_keys.manage': 'Create and revoke API keys',
  'settings.manage': 'Platform settings and maintenance (search reindex)',
  'analytics.read': 'View audience, content, show and project analytics',
};

/** Permissions an API key may carry. Keys are read-only: they only ever authorize GET requests. */
export const API_KEY_SCOPES = ['content.read_drafts', 'analytics.read', 'audit_logs.read', 'users.read', 'leads.manage', 'newsletter.manage'] as const satisfies readonly PermissionKey[];
export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

// ───── Roles & permissions (read-only; defined in code) ─────

export const adminRoleSchema = z.object({
  key: roleKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(permissionKeySchema),
  userCount: z.number().int(),
});
export type AdminRole = z.infer<typeof adminRoleSchema>;
export const adminRoleListSchema = z.object({ items: z.array(adminRoleSchema) });

export const adminPermissionSchema = z.object({
  key: permissionKeySchema,
  description: z.string(),
  roles: z.array(roleKeySchema),
  userCount: z.number().int(),
});
export type AdminPermission = z.infer<typeof adminPermissionSchema>;
export const adminPermissionListSchema = z.object({ items: z.array(adminPermissionSchema) });

// ───── Audit log ─────

export const auditLogQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  actorId: z.string().max(64).optional(),
  targetType: z.string().max(64).optional(),
  targetId: z.string().max(128).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  /** Opaque cursor from the previous page. */
  cursor: z.string().max(200).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  actor: z.object({ id: z.string(), email: z.string(), displayName: z.string() }).nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export const auditLogPageSchema = z.object({ items: z.array(auditLogEntrySchema), nextCursor: z.string().nullable() });
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

// ───── API keys ─────

export const createApiKeyInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(apiKeyScopeSchema).min(1).max(API_KEY_SCOPES.length),
  /** Days until expiry; null for no expiry. */
  expiresInDays: z.number().int().min(1).max(730).nullable().default(90),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export const apiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  owner: z.object({ id: z.string(), email: z.string() }),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ApiKeySummary = z.infer<typeof apiKeySchema>;
export const apiKeyListSchema = z.object({ items: z.array(apiKeySchema) });

export const createdApiKeySchema = z.object({
  key: apiKeySchema,
  /** The full secret. Shown once; only its hash is stored. */
  secret: z.string(),
});
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;
