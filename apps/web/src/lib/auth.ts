import { ApiClientError } from '@stocktank/api-client';
import type { CurrentUser, LoginRequest, RegisterRequest } from '@stocktank/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

/** Resolves to the user, or null when the session is missing/expired (401). */
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

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterRequest) => api.auth.register(input),
    onSuccess: (res) => qc.setQueryData(ME_QUERY_KEY, res.user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      qc.setQueryData(ME_QUERY_KEY, null);
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

/** Human-readable message for API failures on auth forms. */
export function describeAuthError(err: unknown, context: 'login' | 'signup'): string {
  if (err instanceof ApiClientError) {
    switch (err.status) {
      case 401:
        return 'Invalid email or password.';
      case 409:
        return 'That email is already registered. Try signing in instead.';
      case 429:
        return 'Too many attempts. Please wait a moment and try again.';
      case 400:
      case 422:
        return err.message || 'Please check the form and try again.';
      case 0:
        return 'We could not reach StockTank. Check your connection and try again.';
      default:
        return err.message || 'Something went wrong. Please try again.';
    }
  }
  return context === 'login' ? 'Could not sign in. Please try again.' : 'Could not create your account. Please try again.';
}
