'use client';

import { useContext } from 'react';
import { AudioDispatchContext } from '@/contexts/AudioContext';
import type { AudioDispatch } from '@/types/audio';

export function useAudioDispatch(): AudioDispatch {
  const dispatch = useContext(AudioDispatchContext);
  if (!dispatch) {
    throw new Error('useAudioDispatch must be used within AudioProvider');
  }
  return dispatch;
}
