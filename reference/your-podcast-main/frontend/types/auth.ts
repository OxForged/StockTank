// User response matching backend GET /api/auth/me

export interface UserStats {
  readonly total_episodes: number;
  readonly public_episodes: number;
}

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly interests: readonly string[];
  readonly created_at: string;
  readonly stats: UserStats;
}

// Auth state — discriminated union

export type AuthState =
  | { readonly status: 'loading'; readonly user: null }
  | { readonly status: 'authenticated'; readonly user: User }
  | { readonly status: 'unauthenticated'; readonly user: null };

export type AuthAction =
  | { readonly type: 'SET_USER'; readonly user: User }
  | { readonly type: 'SET_UNAUTHENTICATED' }
  | { readonly type: 'CLEAR' };

export interface AuthDispatch {
  login: (provider: 'google') => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
