import type { PersonSummary } from '@stocktank/types';

export const personSelect = {
  id: true,
  slug: true,
  name: true,
  bio: true,
  avatarUrl: true,
  twitter: true,
  isDemo: true,
} as const;

interface PersonRow {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  twitter: string | null;
  isDemo: boolean;
}

export function toHostSummary(h: PersonRow & { isAi?: boolean }): PersonSummary {
  return { id: h.id, slug: h.slug, name: h.name, title: null, bio: h.bio, avatarUrl: h.avatarUrl, twitter: h.twitter, isAi: h.isAi ?? false, role: 'host', isDemo: h.isDemo };
}

export function toGuestSummary(g: PersonRow & { title: string | null }): PersonSummary {
  return { id: g.id, slug: g.slug, name: g.name, title: g.title, bio: g.bio, avatarUrl: g.avatarUrl, twitter: g.twitter, isAi: false, role: 'guest', isDemo: g.isDemo };
}
