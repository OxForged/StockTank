import type { User } from '@/types/auth';
import type { Episode, EpisodeWithSources, Source } from '@/types/audio';
import type { CategoriesResponse, InterestsResponse } from '@/types/onboarding';
import { episodeColor } from '@/lib/format';

// ── Base URL ────────────────────────────────────────────────

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
}

function getApiBaseUrl(): string {
  // In the browser, always use relative paths so requests go through
  // the Next.js rewrite proxy (same origin → no cross-site cookie issues).
  if (typeof window !== 'undefined') {
    // Local dev with a separate backend on port 8000
    const host = window.location.hostname;
    if (isLocalHost(host)) {
      return `http://${host}:8000`;
    }
    // Production: relative path → Vercel rewrites proxy to Railway
    return '';
  }

  // Server-side (SSR / build) — must use absolute URL for Node fetch
  const envBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBaseUrl) return normalizeBaseUrl(envBaseUrl);
  return 'http://localhost:8000';
}

// ── Error ───────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Request ─────────────────────────────────────────────────

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Auth helpers ────────────────────────────────────────────

export function getOAuthUrl(provider: 'google'): string {
  // Use the same base as API calls — in production this is a relative path
  // so OAuth goes through the Vercel rewrite proxy, keeping cookies first-party.
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/auth/${provider}`;
}

export function fetchCurrentUser(): Promise<User> {
  return request<User>('/api/auth/me');
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function devLogin(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/dev-login', { method: 'POST' });
}

export function isLocalDev(): boolean {
  if (typeof window === 'undefined') return process.env.NODE_ENV === 'development';
  return isLocalHost(window.location.hostname);
}

// ── Onboarding helpers ──────────────────────────────────────

export function fetchCategories(signal?: AbortSignal): Promise<CategoriesResponse> {
  return request<CategoriesResponse>('/api/onboarding/categories', { signal });
}

export function submitInterests(interests: string[]): Promise<InterestsResponse> {
  return request<InterestsResponse>('/api/onboarding/interests', {
    method: 'POST',
    body: JSON.stringify({ interests }),
  });
}

// ── API response types (snake_case from backend) ───────────

interface ApiEpisode {
  id: string;
  title: string;
  keywords: string[];
  cover_url: string;
  audio_url: string;
  duration: number;
  is_public: boolean;
  creator_id: string;
  creator_name: string;
  published_at: string;
}

interface ApiSource {
  id: string;
  title: string;
  url: string;
  source: string;
}

interface ApiEpisodeDetail extends ApiEpisode {
  sources: ApiSource[];
}

interface ApiEpisodeListResponse {
  episodes: ApiEpisode[];
  total: number;
  limit: number;
  offset: number;
}

// ── Adapters (snake_case → camelCase) ──────────────────────

function toEpisode(raw: ApiEpisode): Episode {
  return {
    id: raw.id,
    title: raw.title,
    keywords: raw.keywords,
    coverUrl: raw.cover_url,
    audioUrl: raw.audio_url,
    duration: raw.duration,
    isPublic: raw.is_public,
    creatorId: raw.creator_id,
    creatorName: raw.creator_name,
    publishedAt: raw.published_at,
    color: episodeColor(raw.id),
  };
}

function toSource(raw: ApiSource): Source {
  return { id: raw.id, title: raw.title, url: raw.url, source: raw.source };
}

function toEpisodeWithSources(raw: ApiEpisodeDetail): EpisodeWithSources {
  return {
    ...toEpisode(raw),
    sources: raw.sources.map(toSource),
  };
}

// ── Episode fetch helpers ──────────────────────────────────

export interface EpisodeListResult {
  episodes: Episode[];
  total: number;
}

export async function fetchEpisodes(limit = 20, offset = 0): Promise<EpisodeListResult> {
  const data = await request<ApiEpisodeListResponse>(
    `/api/episodes?limit=${limit}&offset=${offset}`,
  );
  return { episodes: data.episodes.map(toEpisode), total: data.total };
}

export async function fetchMyEpisodes(limit = 20, offset = 0): Promise<EpisodeListResult> {
  const data = await request<ApiEpisodeListResponse>(
    `/api/episodes/me?limit=${limit}&offset=${offset}`,
  );
  return { episodes: data.episodes.map(toEpisode), total: data.total };
}

// ── Generate helpers ────────────────────────────────────────

interface GenerateResponse {
  task_id: string;
  status: string;
  message: string;
}

interface TaskResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: string;
  episode_id: string | null;
}

export async function generateEpisode(keywords?: readonly string[]): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(keywords?.length ? { keywords } : {}),
  });
}

export async function fetchTaskStatus(taskId: string): Promise<TaskResponse> {
  return request<TaskResponse>(`/api/tasks/${taskId}`);
}

// ── Episode detail ──────────────────────────────────────────

export async function fetchEpisodeDetail(id: string): Promise<EpisodeWithSources> {
  const data = await request<ApiEpisodeDetail>(`/api/episodes/${id}`);
  return toEpisodeWithSources(data);
}
