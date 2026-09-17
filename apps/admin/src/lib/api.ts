import { createApiClient } from '@stocktank/api-client';

/**
 * Same-origin in dev (Vite proxies /api to the API) and in production behind the edge.
 * Override with VITE_API_ORIGIN for split deployments (cookies then need SameSite/CORS config).
 */
export const api = createApiClient({ baseUrl: import.meta.env.VITE_API_ORIGIN ?? '' });
