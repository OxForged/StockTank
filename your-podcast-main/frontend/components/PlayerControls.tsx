'use client';

import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { PlayIcon } from '@/components/icons/PlayIcon';
import { PauseIcon } from '@/components/icons/PauseIcon';
import { SkipBackIcon } from '@/components/icons/SkipBackIcon';
import { SkipForwardIcon } from '@/components/icons/SkipForwardIcon';

export function PlayerControls() {
  const { isPlaying, currentEpisode } = useAudioState();
  const { pause, resume, skipForward, skipBack } = useAudioDispatch();
  const color = currentEpisode?.color ?? '#111';

  const PlayPauseIcon = isPlaying ? PauseIcon : PlayIcon;

  return (
    <div className="flex items-center justify-center gap-8">
      {/* Skip Back 15s */}
      <button
        type="button"
        onClick={() => skipBack()}
        aria-label="Skip back 15 seconds"
        className="size-11 rounded-full border border-[#111]/20 flex items-center justify-center text-[#111] transition-all duration-150 active:scale-90 active:bg-[#111]/5"
      >
        <SkipBackIcon className="size-5" />
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        onClick={isPlaying ? pause : resume}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={`size-16 rounded-full flex items-center justify-center shadow-md transition-all duration-150 active:scale-90 active:brightness-110 ${isPlaying ? 'animate-pulse-ring' : ''}`}
        style={{ backgroundColor: color, '--ring-color': color } as React.CSSProperties}
      >
        <PlayPauseIcon className="size-6 text-white" />
      </button>

      {/* Skip Forward 15s */}
      <button
        type="button"
        onClick={() => skipForward()}
        aria-label="Skip forward 15 seconds"
        className="size-11 rounded-full border border-[#111]/20 flex items-center justify-center text-[#111] transition-all duration-150 active:scale-90 active:bg-[#111]/5"
      >
        <SkipForwardIcon className="size-5" />
      </button>
    </div>
  );
}
