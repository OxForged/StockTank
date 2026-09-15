'use client';

import { use, useState, useEffect } from 'react';
import type { EpisodeWithSources } from '@/types/audio';
import { NowPlaying } from '@/components/NowPlaying';
import { fetchEpisodeDetail } from '@/lib/api';

type LoadState = 'loading' | 'loaded' | 'error';

export default function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [episode, setEpisode] = useState<EpisodeWithSources | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchEpisodeDetail(id)
      .then((data) => {
        if (cancelled) return;
        setEpisode(data);
        setLoadState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="size-8 border-2 border-[#111] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadState === 'error' || !episode) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-inter text-[#666]">Episode not found</p>
      </div>
    );
  }

  return <NowPlaying episode={episode} />;
}
