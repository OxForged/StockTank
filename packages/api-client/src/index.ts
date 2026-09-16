import type { z } from 'zod';
import {
  adminUserListResponseSchema,
  apiErrorSchema,
  authResponseSchema,
  readyResponseSchema,
  versionResponseSchema,
  type AdminUserListResponse,
  type AuthResponse,
  type ErrorCode,
  type LoginRequest,
  type ReadyResponse,
  type RegisterRequest,
  type RoleKey,
  type VersionResponse,
} from '@stocktank/types';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  /** Base URL of the API origin, e.g. "" (same origin via dev proxy) or "https://api.stocktank.tv". */
  baseUrl?: string;
  fetch?: typeof fetch;
}

/**
 * Typed StockTank API client. Uses cookie sessions (`credentials: 'include'`).
 * State-changing requests send `X-Requested-With`, which the API requires as a CSRF defence.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<S extends z.ZodType>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    schema: S | null,
    body?: unknown,
  ): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(method !== 'GET' ? { 'X-Requested-With': 'stocktank' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiClientError(0, 'NETWORK', err instanceof Error ? err.message : 'Network error');
    }

    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const parsed = apiErrorSchema.safeParse(json);
      if (parsed.success) {
        const e = parsed.data.error;
        throw new ApiClientError(res.status, e.code, e.message, e.details);
      }
      throw new ApiClientError(res.status, 'INTERNAL', `Request failed with status ${res.status}`);
    }
    return (schema ? schema.parse(json) : undefined) as z.infer<S>;
  }

  return {
    auth: {
      register: (input: RegisterRequest): Promise<AuthResponse> =>
        request('POST', '/api/v1/auth/register', authResponseSchema, input),
      login: (input: LoginRequest): Promise<AuthResponse> =>
        request('POST', '/api/v1/auth/login', authResponseSchema, input),
      logout: async (): Promise<void> => {
        await request('POST', '/api/v1/auth/logout', null);
      },
      me: (): Promise<AuthResponse> => request('GET', '/api/v1/auth/me', authResponseSchema),
    },
    admin: {
      listUsers: (page = 1, pageSize = 25): Promise<AdminUserListResponse> =>
        request(
          'GET',
          `/api/v1/admin/users?page=${page}&pageSize=${pageSize}`,
          adminUserListResponseSchema,
        ),
      updateUserRoles: async (userId: string, roles: RoleKey[]): Promise<void> => {
        await request('PUT', `/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, null, { roles });
      },
    },
    system: {
      ready: (): Promise<ReadyResponse> => request('GET', '/ready', readyResponseSchema),
      version: (): Promise<VersionResponse> => request('GET', '/version', versionResponseSchema),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
