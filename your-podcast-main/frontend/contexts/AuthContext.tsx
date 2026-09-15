'use client';

import { createContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AuthState, AuthAction, AuthDispatch } from '@/types/auth';
import {
  ApiError,
  fetchCurrentUser,
  devLogin,
  logout as apiLogout,
  getOAuthUrl,
  isLocalDev,
} from '@/lib/api';

// ── Reducer ─────────────────────────────────────────────────

const INITIAL_STATE: AuthState = { status: 'loading', user: null };

function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { status: 'authenticated', user: action.user };
    case 'SET_UNAUTHENTICATED':
      return { status: 'unauthenticated', user: null };
    case 'CLEAR':
      return { status: 'unauthenticated', user: null };
    default:
      return _state;
  }
}

// ── Contexts ────────────────────────────────────────────────

export const AuthStateContext = createContext<AuthState | null>(null);
export const AuthDispatchContext = createContext<AuthDispatch | null>(null);

// ── Provider ────────────────────────────────────────────────

interface AuthProviderProps {
  readonly children: ReactNode;
}

/** Should we skip auto dev-login? True when visiting /login?force=true */
function shouldSkipDevLogin(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/login' &&
    new URLSearchParams(window.location.search).get('force') === 'true'
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, INITIAL_STATE);

  // Init: check session → auto dev-login fallback
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) dispatch({ type: 'SET_USER', user });
      } catch (err) {
        if (cancelled) return;

        // In local dev, auto-login unless on /login?force=true
        if (
          err instanceof ApiError &&
          err.status === 401 &&
          isLocalDev() &&
          !shouldSkipDevLogin()
        ) {
          try {
            await devLogin();
            const user = await fetchCurrentUser();
            if (!cancelled) dispatch({ type: 'SET_USER', user });
            return;
          } catch {
            // dev-login failed — fall through to unauthenticated
          }
        }

        if (!cancelled) dispatch({ type: 'SET_UNAUTHENTICATED' });
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Dispatch actions ────────────────────────────────────

  const login = useCallback((provider: 'google') => {
    // OAuth needs full browser redirect, not fetch
    window.location.href = getOAuthUrl(provider);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Server-side cleanup failed — still clear client state
    }
    dispatch({ type: 'CLEAR' });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      dispatch({ type: 'SET_USER', user });
    } catch {
      dispatch({ type: 'SET_UNAUTHENTICATED' });
    }
  }, []);

  const dispatchActions = useMemo<AuthDispatch>(
    () => ({ login, logout, refreshUser }),
    [login, logout, refreshUser],
  );

  return (
    <AuthStateContext value={state}>
      <AuthDispatchContext value={dispatchActions}>
        {children}
      </AuthDispatchContext>
    </AuthStateContext>
  );
}
