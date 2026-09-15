'use client';

import Link from 'next/link';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { PlayIcon } from '@/components/icons/PlayIcon';
import { PauseIcon } from '@/components/icons/PauseIcon';

export function MiniPlayer() {
  const { currentEpisode, isPlaying, currentTime, duration } = useAudioState();
  const { pause, resume } = useAudioDispatch();

  if (!currentEpisode) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const Icon = isPlaying ? PauseIcon : PlayIcon;

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }

  return (
    <Link
      href={`/episode/${currentEpisode.id}`}
      className="fixed bottom-17 left-0 right-0 z-20 border-t border-border-warm bg-cream/95 backdrop-blur-sm animate-slide-up vt-fixed"
    >
      {/* Progress bar */}
      <div className="h-[2px] bg-border-warm">
        <div
          className="h-full transition-[width] duration-300 ease-linear opacity-60"
          style={{ width: `${progress}%`, backgroundColor: currentEpisode.color }}
        />
      </div>

      {/* Content */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Cover */}
        <div
          className="relative size-10 shrink-0 rounded-lg overflow-hidden"
          style={{ backgroundColor: currentEpisode.color }}
        >
          {currentEpisode.coverUrl && (
            <img
              src={currentEpisode.coverUrl}
              alt={currentEpisode.title}
              className="absolute inset-0 size-full object-cover opacity-80"
            />
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-sm font-bold text-[#111] truncate">
            {currentEpisode.title}
          </p>
          <p className="font-inter text-xs text-[#666] truncate">
            {currentEpisode.creatorName}
          </p>
        </div>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="size-9 shrink-0 rounded-full border-2 flex items-center justify-center transition-transform duration-150 active:scale-90"
          style={{ borderColor: currentEpisode.color, color: currentEpisode.color }}
        >
          <Icon className="size-3.5" />
        </button>
      </div>
    </Link>
  );
}
