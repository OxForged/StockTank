'use client';

import { useContext } from 'react';
import { AuthStateContext } from '@/contexts/AuthContext';
import type { AuthState } from '@/types/auth';

export function useAuth(): AuthState {
  const state = useContext(AuthStateContext);
  if (!state) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return state;
}
