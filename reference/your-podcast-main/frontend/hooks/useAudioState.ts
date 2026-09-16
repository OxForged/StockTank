'use client';

import { useContext } from 'react';
import { AudioStateContext } from '@/contexts/AudioContext';
import type { AudioState } from '@/types/audio';

export function useAudioState(): AudioState {
  const state = useContext(AudioStateContext);
  if (!state) {
    throw new Error('useAudioState must be used within AudioProvider');
  }
  return state;
}
