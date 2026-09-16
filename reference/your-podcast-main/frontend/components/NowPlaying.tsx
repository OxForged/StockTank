'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { EpisodeWithSources } from '@/types/audio';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { formatDuration } from '@/lib/format';
import { ChevronLeftIcon } from '@/components/icons/ChevronLeftIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { PlayerControls } from '@/components/PlayerControls';
import { SourcesList } from '@/components/SourcesList';


interface NowPlayingProps {
  readonly episode: EpisodeWithSources;
}

export function NowPlaying({ episode }: NowPlayingProps) {
  const router = useRouter();
  const { currentEpisode } = useAudioState();
  const { play } = useAudioDispatch();

  // Auto-play if navigating directly to this page and nothing is playing
  useEffect(() => {
    if (currentEpisode?.id !== episode.id) {
      play(episode);
    }
  }, [episode, currentEpisode?.id, play]);

  // Use the currently playing episode data if it matches, otherwise use the route episode
  const displayEpisode = currentEpisode?.id === episode.id ? currentEpisode : episode;

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${displayEpisode.color}15 0%, #fdfdf5 40%)`,
      }}
    >
      <div className="mx-auto w-full max-w-[428px] px-6 pt-4 pb-12">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="size-10 -ml-2 flex items-center justify-center text-[#111] mb-4 animate-fade-in"
        >
          <ChevronLeftIcon className="size-6" />
        </button>

        {/* Cover art */}
        <div className="flex justify-center mb-8 animate-scale-in anim-delay-1">
          <div
            className="relative w-[70%] aspect-square rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: displayEpisode.color }}
          >
            {displayEpisode.coverUrl && (
              <img
                src={displayEpisode.coverUrl}
                alt={displayEpisode.title}
                className="absolute inset-0 size-full object-cover opacity-80"
              />
            )}
          </div>
        </div>

        {/* Title & metadata */}
        <div className="mb-8 animate-fade-in anim-delay-2">
          <h1 className="font-serif font-bold text-2xl leading-tight text-[#111] mb-2">
            {displayEpisode.title}
          </h1>
          <p className="font-inter text-sm text-[#666]">
            {displayEpisode.creatorName} &middot; {formatDuration(displayEpisode.duration)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 animate-fade-in anim-delay-3">
          <ProgressBar />
        </div>

        {/* Controls */}
        <div className="mb-10 animate-fade-in anim-delay-4">
          <PlayerControls />
        </div>

        {/* Sources */}
        <div className="mb-4 animate-fade-in anim-delay-4">
          <SourcesList sources={episode.sources} />
        </div>

      </div>
    </div>
  );
}
