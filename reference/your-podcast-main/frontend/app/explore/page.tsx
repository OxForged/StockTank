'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Episode } from '@/types/audio';
import { SearchInput } from '@/components/SearchInput';
import { EpisodeRow } from '@/components/EpisodeRow';
import { BottomNav } from '@/components/BottomNav';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { fetchEpisodes } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { FALLBACK_EPISODES } from '@/data/episodes';

type LoadState = 'loading' | 'loaded' | 'fallback';

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [episodes, setEpisodes] = useState<readonly Episode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const { currentEpisode, isPlaying } = useAudioState();
  const { toggle, play } = useAudioDispatch();
  const router = useRouter();

  const hasPlayer = currentEpisode !== null;

  useEffect(() => {
    let cancelled = false;
    fetchEpisodes()
      .then((result) => {
        if (cancelled) return;
        setEpisodes(result.episodes);
        setLoadState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setEpisodes(FALLBACK_EPISODES);
        setLoadState('fallback');
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = episodes.filter(
    (ep) =>
      ep.title.toLowerCase().includes(search.toLowerCase()) ||
      ep.creatorName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-cream">
      <main className={`mx-auto w-full max-w-[428px] px-6 pt-6 ${hasPlayer ? 'pb-36' : 'pb-24'}`}>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6 animate-fade-in">
            <h1 className="font-serif text-4xl leading-10 text-[#111]">
              Discover
            </h1>
            <SearchInput value={search} onChange={setSearch} />
          </div>

          {loadState === 'fallback' && (
            <p className="font-inter text-xs text-[#999] text-center -mb-4">
              Could not reach server &mdash; showing demo data
            </p>
          )}

          <div className="flex flex-col gap-4">
            {loadState === 'loading' ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start pb-4 animate-pulse">
                  <div className="size-20 shrink-0 rounded-[10px] bg-[#e5e5e0]" />
                  <div className="flex-1 pt-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[#e5e5e0]" />
                    <div className="h-3 w-1/2 rounded bg-[#e5e5e0]" />
                    <div className="h-3 w-1/3 rounded bg-[#e5e5e0]" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="font-inter text-sm text-[#666] text-center py-8 animate-fade-in">
                No podcasts found.
              </p>
            ) : (
              filtered.map((ep, index) => (
                <EpisodeRow
                  key={ep.id}
                  title={ep.title}
                  keywords={ep.keywords}
                  creatorName={ep.creatorName}
                  duration={formatDuration(ep.duration)}
                  color={ep.color}
                  coverUrl={ep.coverUrl}
                  isPlaying={currentEpisode?.id === ep.id && isPlaying}
                  onPlay={loadState === 'loaded' ? () => toggle(ep) : undefined}
                  onTap={loadState === 'loaded' ? () => {
                    play(ep);
                    router.push(`/episode/${ep.id}`);
                  } : undefined}
                  className="animate-list-item"
                  style={{ animationDelay: `${100 + index * 60}ms` }}
                />
              ))
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
