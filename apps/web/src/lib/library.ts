import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useWatchlist } from '../stores/watchlist';
import { api } from './api';
import { useMe } from './auth';

export const LIBRARY_QUERY_KEY = ['me', 'library'] as const;

export function useLibrary(enabled: boolean) {
  return useQuery({ queryKey: LIBRARY_QUERY_KEY, queryFn: () => api.me.library(), enabled, staleTime: 30_000 });
}

/** Connects the watchlist store to the signed-in account (merging device-saved items), or back to the device. */
export function useWatchlistAccountSync(): void {
  const { user } = useMe();
  const qc = useQueryClient();
  const library = useLibrary(Boolean(user));
  const synced = useWatchlist((s) => s.synced);
  const attach = useWatchlist((s) => s.attachAccount);
  const detach = useWatchlist((s) => s.detachAccount);

  useEffect(() => {
    if (!user) {
      if (synced) detach();
      return;
    }
    if (synced || !library.data) return;
    const accountIds = [
      ...library.data.shows.map((s) => `show:${s.id}`),
      ...library.data.projects.map((p) => `project:${p.id}`),
      ...library.data.companies.map((c) => `company:${c.id}`),
    ];
    const remote = {
      follow: async (target: 'show' | 'project' | 'company', id: string) => {
        await api.me.follow(target, id);
        void qc.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      },
      unfollow: async (target: 'show' | 'project' | 'company', id: string) => {
        await api.me.unfollow(target, id);
        void qc.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      },
    };
    void attach(remote, accountIds);
  }, [user, synced, library.data, attach, detach, qc]);
}
