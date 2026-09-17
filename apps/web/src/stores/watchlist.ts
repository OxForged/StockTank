import type { FollowTarget } from '@stocktank/types';
import { create } from 'zustand';

/**
 * Watchlist / follows. Signed out: saved on this device (localStorage). Signed in: synced to the account through
 * /api/v1/me (items saved on the device are merged in on sign-in). Ids are `show:<id>`, `project:<id>`, `company:<id>`.
 */
const KEY = 'stocktank.watchlist';

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: the watchlist lasts for this visit only.
  }
}

export interface FollowRemote {
  follow: (target: FollowTarget, id: string) => Promise<void>;
  unfollow: (target: FollowTarget, id: string) => Promise<void>;
}

export function parseKey(key: string): { target: FollowTarget; id: string } | null {
  const [target, id] = key.split(':');
  return (target === 'show' || target === 'project' || target === 'company') && id ? { target, id } : null;
}

interface WatchlistState {
  ids: string[];
  /** Set while signed in; toggles then persist to the account. */
  remote: FollowRemote | null;
  synced: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  attachAccount: (remote: FollowRemote, accountIds: string[]) => Promise<void>;
  detachAccount: () => void;
}

export const useWatchlist = create<WatchlistState>((set, get) => ({
  ids: load(),
  remote: null,
  synced: false,
  has: (id) => get().ids.includes(id),
  toggle: (key) => {
    const { ids, remote } = get();
    const adding = !ids.includes(key);
    const next = adding ? [...ids, key] : ids.filter((x) => x !== key);
    set({ ids: next });
    if (!remote) {
      save(next);
      return;
    }
    const parsed = parseKey(key);
    if (!parsed) return;
    const call = adding ? remote.follow(parsed.target, parsed.id) : remote.unfollow(parsed.target, parsed.id);
    call.catch(() => {
      // Revert the optimistic change if the account update failed and nothing else changed meanwhile.
      if (get().ids === next) set({ ids });
    });
  },
  attachAccount: async (remote, accountIds) => {
    const local = load();
    const toUpload = local.filter((k) => !accountIds.includes(k));
    const uploaded: string[] = [];
    for (const key of toUpload) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      try {
        await remote.follow(parsed.target, parsed.id);
        uploaded.push(key);
      } catch {
        // Unpublished or unknown items are dropped rather than blocking sign-in.
      }
    }
    save([]);
    set({ remote, synced: true, ids: [...new Set([...accountIds, ...uploaded])] });
  },
  detachAccount: () => set({ remote: null, synced: false, ids: load() }),
}));
