'use client';

import { useContext } from 'react';
import { AuthDispatchContext } from '@/contexts/AuthContext';
import type { AuthDispatch } from '@/types/auth';

export function useAuthDispatch(): AuthDispatch {
  const dispatch = useContext(AuthDispatchContext);
  if (!dispatch) {
    throw new Error('useAuthDispatch must be used within AuthProvider');
  }
  return dispatch;
}
