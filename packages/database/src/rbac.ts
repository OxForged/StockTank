import type { PermissionKey, RoleKey } from '@stocktank/types';
import { PERMISSIONS } from '@stocktank/types';

export const ROLE_DEFINITIONS: Record<
  RoleKey,
  { name: string; description: string; permissions: readonly PermissionKey[] }
> = {
  super_admin: { name: 'Super Admin', description: 'Full platform control', permissions: PERMISSIONS },
  admin: {
    name: 'Admin',
    description: 'Operates the platform; cannot manage roles',
    permissions: PERMISSIONS.filter((p) => p !== 'roles.manage'),
  },
  editor: {
    name: 'Editor',
    description: 'Reviews, approves and publishes content',
    permissions: [
      'content.read_drafts',
      'content.write',
      'content.publish',
      'entities.write',
      'ai.review',
      'distribution.publish',
      'ads.approve',
    ],
  },
  sales: {
    name: 'Sales',
    description: 'Manages advertisers, campaigns, creatives and leads; approvals need an editor',
    permissions: ['ads.manage', 'leads.manage'],
  },
  creator: {
    name: 'Creator',
    description: 'Creates drafts; publishing requires an editor',
    permissions: ['content.read_drafts', 'content.write'],
  },
  viewer: { name: 'Viewer', description: 'Standard audience account', permissions: [] },
};

/** Unfinished features ship disabled (§50). */
export const FEATURE_FLAG_DEFINITIONS: ReadonlyArray<{ key: string; description: string }> = [
  { key: 'ai_hosts', description: 'AI personality hosts' },
  { key: 'ai_clips', description: 'AI-assisted clipping' },
  { key: 'ai_newsroom', description: 'AI newsroom pipeline' },
  { key: 'wallet', description: 'Optional wallet connection' },
  { key: 'mobile', description: 'Mobile app surfaces' },
  { key: 'tv', description: 'TV / OTT surfaces' },
  { key: 'advertising', description: 'First-party advertising' },
  { key: 'creator_monetization', description: 'Creator monetization' },
  { key: 'live_streaming', description: 'Live streaming / radio' },
];
