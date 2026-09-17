import { create } from 'zustand';

/**
 * Watchlist saved on this device (localStorage). Account-synced follows arrive with the follows API
 * (Milestone 2); the UI labels this as "saved on this device" so it never implies otherwise.
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

interface WatchlistState {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
}

export const useWatchlist = create<WatchlistState>((set, get) => ({
  ids: load(),
  has: (id) => get().ids.includes(id),
  toggle: (id) => {
    const ids = get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [...get().ids, id];
    save(ids);
    set({ ids });
  },
}));
