import type { PermissionKey, RoleKey } from '@stocktank/types';

/** The authenticated principal attached to `req.auth` by the session middleware. */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    status: 'active' | 'suspended';
    displayName: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
  roles: RoleKey[];
  permissions: PermissionKey[];
  sessionId: string;
  /** Set when the request authenticated with an API key instead of a session cookie. */
  apiKeyId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present only when a valid, unexpired, unrevoked session cookie was supplied. */
      auth?: AuthContext;
    }
  }
}

export {};
