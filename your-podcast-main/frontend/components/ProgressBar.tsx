'use client';

import { useRef, useState, useCallback } from 'react';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';

const SEEK_STEP_SECONDS = 5;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ProgressBar() {
  const { currentTime, duration, isPlaying, currentEpisode } = useAudioState();
  const color = currentEpisode?.color ?? '#111';
  const { seek } = useAudioDispatch();
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const displayTime = dragTime ?? currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const getTimeFromEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const clearDraggingState = useCallback(() => {
    isDragging.current = false;
    setIsDraggingState(false);
    setDragTime(null);
  }, []);

  const commitPointerSeek = useCallback((clientX: number) => {
    seek(getTimeFromEvent(clientX));
  }, [getTimeFromEvent, seek]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (duration <= 0) return;
    isDragging.current = true;
    setIsDraggingState(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragTime(getTimeFromEvent(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    setDragTime(getTimeFromEvent(e.clientX));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    commitPointerSeek(e.clientX);
    clearDraggingState();
  }

  function handlePointerCancel() {
    clearDraggingState();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (duration <= 0) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        seek(Math.max(0, currentTime - SEEK_STEP_SECONDS));
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(Math.min(duration, currentTime + SEEK_STEP_SECONDS));
        break;
      case 'Home':
        e.preventDefault();
        seek(0);
        break;
      case 'End':
        e.preventDefault();
        seek(duration);
        break;
      default:
        break;
    }
  }

  return (
    <div className="w-full px-2">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-6 flex items-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(displayTime)}
        aria-valuetext={formatTime(displayTime)}
        tabIndex={0}
      >
        {/* Background track */}
        <div className="absolute left-0 right-0 h-1 rounded-full bg-border-warm" />
        {/* Filled track */}
        <div
          className="absolute left-0 h-1 rounded-full transition-[width] duration-100 ease-linear opacity-70"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
        {/* Thumb */}
        <div
          className={`absolute rounded-full -translate-x-1/2 shadow-sm transition-all duration-150 ${
            isDraggingState ? 'size-5 shadow-md' : isPlaying ? 'size-3.5' : 'size-3'
          }`}
          style={{ left: `${progress}%`, backgroundColor: color, opacity: isDraggingState ? 1 : 0.7 }}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1">
        <span className="font-inter text-xs text-[#666]">{formatTime(displayTime)}</span>
        <span className="font-inter text-xs text-[#666]">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
