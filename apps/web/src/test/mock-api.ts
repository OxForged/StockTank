import type { ApiClient } from '@stocktank/api-client';
import { vi } from 'vitest';

/**
 * A fully mocked API client. Test files install it with:
 *   vi.mock('@stocktank/api-client', async (orig) => ({ ...(await orig()), createApiClient: () => mockApi }));
 */
export const mockApi = {
  auth: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
  admin: {
    listUsers: vi.fn(),
    updateUserRoles: vi.fn(),
  },
  system: {
    ready: vi.fn(),
    version: vi.fn(),
  },
} as unknown as ApiClient & {
  auth: { [K in keyof ApiClient['auth']]: ReturnType<typeof vi.fn> };
  admin: { [K in keyof ApiClient['admin']]: ReturnType<typeof vi.fn> };
  system: { [K in keyof ApiClient['system']]: ReturnType<typeof vi.fn> };
};
