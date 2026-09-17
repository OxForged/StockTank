import { ApiClientError } from '@stocktank/api-client';
import type { CurrentUser, LoginRequest, PermissionKey } from '@stocktank/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export async function fetchMe(): Promise<CurrentUser | null> {
  try {
    const res = await api.auth.me();
    return res.user;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) return null;
    throw err;
  }
}

export function useMe() {
  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiClientError && err.status < 500) && count < 2,
  });
  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => api.auth.login(input),
    onSuccess: (res) => qc.setQueryData(ME_QUERY_KEY, res.user),
  });
}

/** Local development only: is one-click staff sign-in available? */
export function useDevLoginStatus() {
  return useQuery({
    queryKey: ['auth', 'dev-login'],
    queryFn: async () => {
      try {
        return (await api.auth.devLoginStatus()).enabled;
      } catch {
        return false;
      }
    },
    enabled: import.meta.env.DEV,
    staleTime: Infinity,
    retry: false,
  });
}

export function useDevLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.devLogin(),
    onSuccess: (res) => qc.setQueryData(ME_QUERY_KEY, res.user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(ME_QUERY_KEY, null);
    },
  });
}

/** Any granted permission opens the control room; what you can see inside is gated per item. */
export function hasAdminAccess(user: CurrentUser | null): boolean {
  return Boolean(user && user.permissions.length > 0);
}

export function can(user: CurrentUser | null, permission: PermissionKey | undefined): boolean {
  if (!permission) return Boolean(user);
  return Boolean(user?.permissions.includes(permission));
}

export function describeAuthError(err: unknown): string {
  if (err instanceof ApiClientError) {
    switch (err.status) {
      case 401:
        return 'Invalid email or password.';
      case 429:
        return 'Too many attempts. Please wait a moment and try again.';
      case 0:
        return 'Could not reach the StockTank API. Is it running?';
      default:
        return err.message || 'Something went wrong. Please try again.';
    }
  }
  return 'Could not sign in. Please try again.';
}

export function describeApiError(err: unknown): string {
  if (err instanceof ApiClientError) {
    switch (err.status) {
      case 401:
        return 'Your session has expired. Sign in again.';
      case 403:
        return 'You do not have permission to do that.';
      case 404:
        return 'Not found.';
      case 409:
        return err.message || 'Conflict with the current state.';
      case 429:
        return 'Rate limited. Try again shortly.';
      case 0:
        return 'Could not reach the API.';
      default:
        return err.message || `Request failed (${err.status}).`;
    }
  }
  return err instanceof Error ? err.message : 'Unexpected error.';
}
