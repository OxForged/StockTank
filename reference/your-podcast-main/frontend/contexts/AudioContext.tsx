'use client';

import { createContext, useReducer, useRef, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AudioState, AudioAction, AudioDispatch, Episode } from '@/types/audio';

const INITIAL_STATE: AudioState = {
  currentEpisode: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
};

function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'PLAY':
      return {
        ...state,
        currentEpisode: action.episode,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
        duration: action.episode.duration,
      };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'RESUME':
      return { ...state, isPlaying: true };
    case 'STOP':
      return INITIAL_STATE;
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_TIME':
      return { ...state, currentTime: action.currentTime };
    case 'SET_DURATION':
      return { ...state, duration: action.duration };
    default:
      return state;
  }
}

export const AudioStateContext = createContext<AudioState | null>(null);
export const AudioDispatchContext = createContext<AudioDispatch | null>(null);

interface AudioProviderProps {
  readonly children: ReactNode;
}

const SKIP_SECONDS = 15;
const TIME_UPDATE_INTERVAL = 250; // 4Hz

export function AudioProvider({ children }: AudioProviderProps) {
  const [state, dispatch] = useReducer(audioReducer, INITIAL_STATE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const clearTimeInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startSimulatedTimer = useCallback(() => {
    clearTimeInterval();
    intervalRef.current = setInterval(() => {
      const { currentTime, duration } = stateRef.current;
      const next = currentTime + TIME_UPDATE_INTERVAL / 1000;
      if (next >= duration) {
        clearTimeInterval();
        dispatch({ type: 'PAUSE' });
        dispatch({ type: 'SET_TIME', currentTime: 0 });
      } else {
        dispatch({ type: 'SET_TIME', currentTime: next });
      }
    }, TIME_UPDATE_INTERVAL);
  }, [clearTimeInterval]);

  const play = useCallback((episode: Episode) => {
    const audio = audioRef.current;
    if (!audio) return;

    clearTimeInterval();
    dispatch({ type: 'PLAY', episode });

    if (episode.audioUrl) {
      audio.src = episode.audioUrl;
      audio.load();
      audio.play().catch(() => {
        dispatch({ type: 'PAUSE' });
      });
    } else {
      // No audio URL — simulate playback for demo
      dispatch({ type: 'SET_LOADING', isLoading: false });
      startSimulatedTimer();
    }
  }, [clearTimeInterval, startSimulatedTimer]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.pause();
    }
    clearTimeInterval();
    dispatch({ type: 'PAUSE' });
  }, [clearTimeInterval]);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.play().catch(() => {
        dispatch({ type: 'PAUSE' });
      });
    } else {
      // Simulated playback
      startSimulatedTimer();
    }
    dispatch({ type: 'RESUME' });
  }, [startSimulatedTimer]);

  const toggle = useCallback((episode: Episode) => {
    const { currentEpisode, isPlaying } = stateRef.current;
    if (currentEpisode?.id === episode.id) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      play(episode);
    }
  }, [pause, resume, play]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.currentTime = time;
    }
    dispatch({ type: 'SET_TIME', currentTime: time });
    // In simulated mode, restart timer from new position to prevent drift
    if (!(audio?.src) && stateRef.current.isPlaying) {
      startSimulatedTimer();
    }
  }, [startSimulatedTimer]);

  const skipForward = useCallback((seconds: number = SKIP_SECONDS) => {
    const { currentTime, duration } = stateRef.current;
    const audio = audioRef.current;
    const newTime = Math.min(
      (audio?.src ? audio.currentTime : currentTime) + seconds,
      duration
    );
    seek(newTime);
  }, [seek]);

  const skipBack = useCallback((seconds: number = SKIP_SECONDS) => {
    const { currentTime } = stateRef.current;
    const audio = audioRef.current;
    const newTime = Math.max(
      (audio?.src ? audio.currentTime : currentTime) - seconds,
      0
    );
    seek(newTime);
  }, [seek]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    clearTimeInterval();
    dispatch({ type: 'STOP' });
  }, [clearTimeInterval]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleCanPlay() {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }

    function handleDurationChange() {
      if (audio) {
        dispatch({ type: 'SET_DURATION', duration: audio.duration });
      }
    }

    function handleTimeUpdate() {
      if (audio) {
        dispatch({ type: 'SET_TIME', currentTime: audio.currentTime });
      }
    }

    function handleEnded() {
      clearTimeInterval();
      dispatch({ type: 'PAUSE' });
      dispatch({ type: 'SET_TIME', currentTime: 0 });
    }

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [clearTimeInterval]);

  const dispatchActions = useMemo<AudioDispatch>(() => ({
    play,
    pause,
    resume,
    toggle,
    seek,
    skipForward,
    skipBack,
    stop,
  }), [play, pause, resume, toggle, seek, skipForward, skipBack, stop]);

  return (
    <AudioStateContext value={state}>
      <AudioDispatchContext value={dispatchActions}>
        <audio ref={audioRef} preload="metadata" hidden />
        {children}
      </AudioDispatchContext>
    </AudioStateContext>
  );
}
