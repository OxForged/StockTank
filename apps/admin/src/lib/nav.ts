import type { CurrentUser, PermissionKey } from '@stocktank/types';
import {
  Activity,
  Bot,
  Boxes,
  Brain,
  Building2,
  ChartBar,
  Coins,
  Film,
  Flag,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquareText,
  Mic,
  Newspaper,
  Radio,
  Rss,
  Scissors,
  ScrollText,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Tv,
  UserRound,
  Users,
  Video,
  Wallet,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  to: string;
  icon?: typeof LayoutDashboard;
  /** Permission required to see the item. Omit for any admin user. */
  permission?: PermissionKey;
  /** README §53 milestone that builds this page. Omit when it works today. */
  milestone?: number;
  /** Short description used on the placeholder page. */
  description?: string;
}

export interface AdminNavGroup {
  label: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey;
  items: readonly AdminNavItem[];
}

/** Navigation exactly per README §28. */
export const ADMIN_NAV: readonly (AdminNavItem | AdminNavGroup)[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  {
    label: 'Content',
    icon: Film,
    permission: 'content.read_drafts',
    items: [
      { label: 'Episodes', to: '/content/episodes', icon: Tv, milestone: 2, description: 'Create, schedule and publish episodes across shows.' },
      { label: 'Videos', to: '/content/videos', icon: Video, milestone: 3, description: 'Uploads, transcoding status and HLS renditions.' },
      { label: 'Clips', to: '/content/clips', icon: Scissors, milestone: 3, description: 'Cut, review and publish clips from episodes and live shows.' },
      { label: 'Articles', to: '/content/articles', icon: Newspaper, milestone: 2, description: 'Editorial articles with drafts, review and publishing.' },
      { label: 'Shorts', to: '/content/shorts', icon: Smartphone, milestone: 3, description: 'Vertical short-form video for social distribution.' },
    ],
  },
  {
    label: 'Network',
    icon: Radio,
    permission: 'content.read_drafts',
    items: [
      { label: 'Shows', to: '/network/shows', icon: Tv, milestone: 2, description: 'Shows, formats, seasons and artwork.' },
      { label: 'Hosts', to: '/network/hosts', icon: Mic, milestone: 2, description: 'Host profiles and show assignments.' },
      { label: 'Guests', to: '/network/guests', icon: UserRound, milestone: 2, description: 'Guest profiles and appearances.' },
      { label: 'Creators', to: '/network/creators', icon: Users, milestone: 2, description: 'Creator accounts, channels and approvals.' },
    ],
  },
  {
    label: 'Entities',
    icon: Boxes,
    permission: 'entities.write',
    items: [
      { label: 'Companies', to: '/entities/companies', icon: Building2, milestone: 2, description: 'Public companies, tickers and sectors.' },
      { label: 'Projects', to: '/entities/projects', icon: Boxes, milestone: 2, description: 'On-chain projects and their relationships.' },
      { label: 'Tokens', to: '/entities/tokens', icon: Coins, milestone: 2, description: 'Tokens linked to projects and chains.' },
      { label: 'Chains', to: '/entities/chains', icon: Link2, milestone: 2, description: 'Supported chains and metadata.' },
    ],
  },
  {
    label: 'AI',
    icon: Sparkles,
    permission: 'ai.review',
    items: [
      { label: 'Personalities', to: '/ai/personalities', icon: Bot, milestone: 7, description: 'AI personalities, voices and guardrails.' },
      { label: 'Prompts', to: '/ai/prompts', icon: MessageSquareText, milestone: 7, description: 'Versioned prompt templates.' },
      { label: 'Knowledge', to: '/ai/knowledge', icon: Brain, milestone: 7, description: 'RAG sources, indexing and freshness.' },
      { label: 'AI jobs', to: '/ai/jobs', icon: Activity, milestone: 7, description: 'Transcription, summaries, clipping and generation jobs.' },
      { label: 'Review queue', to: '/ai/review', icon: ListChecks, milestone: 7, description: 'Human review of AI-assisted output before publishing.' },
    ],
  },
  {
    label: 'Distribution',
    icon: Share2,
    permission: 'distribution.publish',
    items: [
      { label: 'YouTube', to: '/distribution/youtube', milestone: 8 },
      { label: 'X', to: '/distribution/x', milestone: 8 },
      { label: 'Instagram', to: '/distribution/instagram', milestone: 8 },
      { label: 'TikTok', to: '/distribution/tiktok', milestone: 8 },
      { label: 'Facebook', to: '/distribution/facebook', milestone: 8 },
      { label: 'RSS', to: '/distribution/rss', icon: Rss, milestone: 4 },
    ],
  },
  {
    label: 'Live',
    icon: Radio,
    permission: 'content.publish',
    items: [
      { label: 'Stations', to: '/live/stations', milestone: 5 },
      { label: 'Streams', to: '/live/streams', milestone: 5 },
      { label: 'Now Playing', to: '/live/now-playing', milestone: 5 },
    ],
  },
  {
    label: 'Analytics',
    icon: ChartBar,
    items: [
      { label: 'Audience', to: '/analytics/audience', milestone: 6 },
      { label: 'Content', to: '/analytics/content', milestone: 6 },
      { label: 'Projects', to: '/analytics/projects', milestone: 6 },
      { label: 'Shows', to: '/analytics/shows', milestone: 6 },
      { label: 'Revenue', to: '/analytics/revenue', icon: Coins, milestone: 11 },
    ],
  },
  {
    label: 'Advertising',
    icon: Megaphone,
    items: [
      { label: 'Overview', to: '/advertising/overview', icon: ChartBar, permission: 'ads.manage' },
      { label: 'Advertisers', to: '/advertising/advertisers', icon: Building2, permission: 'ads.manage' },
      { label: 'Campaigns', to: '/advertising/campaigns', icon: Megaphone, permission: 'ads.manage' },
      { label: 'Review queue', to: '/advertising/review', icon: ListChecks, permission: 'ads.approve' },
      { label: 'Rate card', to: '/advertising/placements', icon: Wallet, permission: 'ads.manage' },
    ],
  },
  {
    label: 'Growth',
    icon: Inbox,
    items: [
      { label: 'Leads', to: '/growth/leads', icon: Inbox, permission: 'leads.manage' },
      { label: 'Newsletter', to: '/growth/newsletter', icon: Mail, permission: 'newsletter.manage' },
    ],
  },
  {
    label: 'System',
    icon: Shield,
    items: [
      { label: 'Users', to: '/system/users', icon: Users, permission: 'users.read' },
      { label: 'Roles', to: '/system/roles', icon: Shield, permission: 'roles.manage', milestone: 6, description: 'Role definitions and their permission sets.' },
      { label: 'Permissions', to: '/system/permissions', icon: ListChecks, permission: 'roles.manage', milestone: 6, description: 'Permission catalogue and usage.' },
      { label: 'API keys', to: '/system/api-keys', icon: KeyRound, permission: 'api_keys.manage', milestone: 6, description: 'Service and partner API keys.' },
      { label: 'Feature flags', to: '/system/feature-flags', icon: Flag, permission: 'feature_flags.manage' },
      { label: 'Audit logs', to: '/system/audit-logs', icon: ScrollText, permission: 'audit_logs.read', milestone: 6, description: 'Who changed what, and when.' },
    ],
  },
];

export function isGroup(entry: AdminNavItem | AdminNavGroup): entry is AdminNavGroup {
  return 'items' in entry;
}

function allowed(user: CurrentUser, permission: PermissionKey | undefined): boolean {
  return !permission || user.permissions.includes(permission);
}

/** Navigation filtered to what the user may see. Groups with no visible items are dropped. */
export function visibleNav(user: CurrentUser): (AdminNavItem | AdminNavGroup)[] {
  const out: (AdminNavItem | AdminNavGroup)[] = [];
  for (const entry of ADMIN_NAV) {
    if (isGroup(entry)) {
      if (!allowed(user, entry.permission)) continue;
      const items = entry.items.filter((i) => allowed(user, i.permission));
      if (items.length) out.push({ ...entry, items });
    } else if (allowed(user, entry.permission)) {
      out.push(entry);
    }
  }
  return out;
}

/** Flat list of every leaf route, with its group label, for routing and placeholder pages. */
export function allNavItems(): Array<AdminNavItem & { group?: string }> {
  const out: Array<AdminNavItem & { group?: string }> = [];
  for (const entry of ADMIN_NAV) {
    if (isGroup(entry)) {
      for (const item of entry.items) out.push({ ...item, group: entry.label, permission: item.permission ?? entry.permission });
    } else {
      out.push(entry);
    }
  }
  return out;
}
