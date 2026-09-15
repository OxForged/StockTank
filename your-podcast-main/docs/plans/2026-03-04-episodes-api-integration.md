# Episodes API Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect frontend explore page, shows page, and episode detail page to the backend `/api/episodes` endpoints, replacing hardcoded data.

**Architecture:** Simplify backend response (remove `CreatorInfo` object → flat `creator_name`, remove `transcript` from detail). Update frontend `Episode` type to match API shape with camelCase conversion. Explore/shows pages fetch from API with fallback to hardcoded data (interaction disabled). Episode detail page fetches from API directly.

**Tech Stack:** FastAPI (backend), Next.js App Router + TypeScript (frontend), Cloudflare D1 (database)

---

### Task 1: Backend — Simplify schemas and remove transcript from detail

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/episodes.py`
- Modify: `backend/app/d1_database.py`

**Step 1: Simplify `schemas.py`**

Remove `CreatorInfo` and `TranscriptItem`. Replace `creator: CreatorInfo` with `creator_name: str` on `EpisodeListItem`. Remove `transcript` from `EpisodeDetail`.

```python
from datetime import datetime

from pydantic import BaseModel

from app.models import TaskStatus


# ── Episodes ──────────────────────────────────────────────────


class SourceItem(BaseModel):
    id: str
    title: str
    url: str
    source: str


class EpisodeListItem(BaseModel):
    id: str
    title: str
    description: str
    cover_url: str
    audio_url: str
    duration: int
    is_public: bool
    creator_id: str
    creator_name: str
    published_at: datetime


class EpisodeDetail(EpisodeListItem):
    sources: list[SourceItem]


class EpisodeListResponse(BaseModel):
    episodes: list[EpisodeListItem]
    total: int
    limit: int
    offset: int


# ── User ──────────────────────────────────────────────────────


class UserStats(BaseModel):
    total_episodes: int
    public_episodes: int


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: str
    interests: list[str]
    created_at: datetime
    stats: UserStats


# ── Task ──────────────────────────────────────────────────────


class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    progress: str
    episode_id: str | None
```

**Step 2: Update `d1_database.py` — remove avatar_url from JOIN, remove transcript query**

In `list_public_episodes` and `list_user_episodes`, change the SQL to only select `u.name AS creator_name` (drop `u.avatar_url AS creator_avatar_url`).

In `get_episode_detail`, remove the transcript query entirely. Only query sources.

```python
# In list_public_episodes and list_user_episodes, change the SELECT to:
"""SELECT e.*, u.name AS creator_name
   FROM episode e
   JOIN user u ON e.creator_id = u.id
   WHERE e.is_public = 1
   ORDER BY e.published_at DESC
   LIMIT ? OFFSET ?"""

# In get_episode_detail, remove the transcript query:
async def get_episode_detail(db: D1Client, episode_id: str) -> dict | None:
    rows = await db.execute(
        """SELECT e.*, u.name AS creator_name
           FROM episode e
           JOIN user u ON e.creator_id = u.id
           WHERE e.id = ?""",
        [episode_id],
    )
    if not rows:
        return None

    episode = rows[0]

    sources = await db.execute(
        "SELECT * FROM source WHERE episode_id = ?", [episode_id]
    )

    episode["sources"] = sources
    return episode
```

**Step 3: Update `routers/episodes.py`**

Simplify `_row_to_list_item` — use `creator_name` directly instead of building `CreatorInfo`. Remove `TranscriptItem` import. Remove transcript mapping from `get_episode`.

```python
from fastapi import APIRouter, Depends, HTTPException, Query

from app import d1_database
from app.auth import get_current_user, get_optional_user
from app.database import get_db
from app.schemas import (
    EpisodeDetail,
    EpisodeListItem,
    EpisodeListResponse,
    SourceItem,
)
from app.services.d1 import D1Client

router = APIRouter(prefix="/api/episodes", tags=["episodes"])


def _row_to_list_item(row: dict) -> EpisodeListItem:
    return EpisodeListItem(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        cover_url=row["cover_url"],
        audio_url=row["audio_url"],
        duration=row["duration"],
        is_public=bool(row["is_public"]),
        creator_id=row["creator_id"],
        creator_name=row["creator_name"],
        published_at=row["published_at"],
    )
```

Remove transcript from `get_episode`:
```python
    return EpisodeDetail(
        **item.model_dump(),
        sources=[SourceItem(id=s["id"], title=s["title"], url=s["url"], source=s["source"]) for s in ep["sources"]],
    )
```

**Step 4: Verify backend**

Run: `curl -s http://localhost:8000/api/episodes | python3 -m json.tool`

Expected: Episodes with flat `creator_name` field, no `creator` object.

Run: `curl -s http://localhost:8000/api/episodes/<id> | python3 -m json.tool`

Expected: Episode detail with `sources`, no `transcript`.

**Step 5: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/episodes.py backend/app/d1_database.py
git commit -m "refactor(api): simplify episode response — flat creator_name, remove transcript"
```

---

### Task 2: Frontend — Update types and add API helpers

**Files:**
- Modify: `frontend/types/audio.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/lib/format.ts`

**Step 1: Rewrite `types/audio.ts`**

Rename `EpisodeDetail` → `Episode` (used for lists and audio). Add `EpisodeWithSources` for detail page. Update all audio types to reference `Episode`. Rename fields to camelCase matching the new API shape.

```typescript
export interface Source {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
}

export interface Episode {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly coverUrl: string;
  readonly audioUrl: string;
  readonly duration: number;
  readonly isPublic: boolean;
  readonly creatorId: string;
  readonly creatorName: string;
  readonly publishedAt: string;
  readonly color: string;
}

export interface EpisodeWithSources extends Episode {
  readonly sources: readonly Source[];
}

export interface AudioState {
  readonly currentEpisode: Episode | null;
  readonly isPlaying: boolean;
  readonly isLoading: boolean;
  readonly currentTime: number;
  readonly duration: number;
}

export type AudioAction =
  | { readonly type: 'PLAY'; readonly episode: Episode }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'STOP' }
  | { readonly type: 'SET_LOADING'; readonly isLoading: boolean }
  | { readonly type: 'SET_TIME'; readonly currentTime: number }
  | { readonly type: 'SET_DURATION'; readonly duration: number };

export interface AudioDispatch {
  play: (episode: Episode) => void;
  pause: () => void;
  resume: () => void;
  toggle: (episode: Episode) => void;
  seek: (time: number) => void;
  skipForward: (seconds?: number) => void;
  skipBack: (seconds?: number) => void;
  stop: () => void;
}
```

**Step 2: Create `frontend/lib/format.ts`**

```typescript
const PALETTE = [
  '#f54900', '#009689', '#432dd7', '#155dfc', '#ff637e',
  '#e65100', '#00897b', '#5c6bc0', '#0288d1', '#c62828',
] as const;

export function episodeColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}
```

**Step 3: Add episode API helpers to `frontend/lib/api.ts`**

Add these after the existing auth helpers:

```typescript
import type { Episode, EpisodeWithSources, Source } from '@/types/audio';
import { episodeColor } from '@/lib/format';

// ── API response types (snake_case) ────────────────────────

interface ApiEpisode {
  id: string;
  title: string;
  description: string;
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

// ── Adapters ───────────────────────────────────────────────

function toEpisode(raw: ApiEpisode): Episode {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
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

// ── Episode helpers ────────────────────────────────────────

export interface EpisodeListResult {
  episodes: Episode[];
  total: number;
}

export async function fetchEpisodes(limit = 20, offset = 0): Promise<EpisodeListResult> {
  const data = await request<ApiEpisodeListResponse>(
    `/api/episodes?limit=${limit}&offset=${offset}`,
  );
  return {
    episodes: data.episodes.map(toEpisode),
    total: data.total,
  };
}

export async function fetchEpisodeDetail(id: string): Promise<EpisodeWithSources> {
  const data = await request<ApiEpisodeDetail>(`/api/episodes/${id}`);
  return toEpisodeWithSources(data);
}
```

**Step 4: Commit**

```bash
git add frontend/types/audio.ts frontend/lib/api.ts frontend/lib/format.ts
git commit -m "feat(frontend): update Episode types and add API helpers"
```

---

### Task 3: Frontend — Update AudioContext, MiniPlayer, and shared components

**Files:**
- Modify: `frontend/contexts/AudioContext.tsx`
- Modify: `frontend/components/MiniPlayer.tsx`
- Modify: `frontend/components/EpisodeRow.tsx`
- Modify: `frontend/components/NowPlaying.tsx`
- Modify: `frontend/components/SourcesList.tsx`
- Modify: `frontend/components/PlayerControls.tsx`
- Modify: `frontend/components/ProgressBar.tsx`

**Step 1: Update `AudioContext.tsx`**

Change `EpisodeDetail` import to `Episode`. Change `durationSeconds` to `duration`.

```typescript
// Line 5: change import
import type { AudioState, AudioAction, AudioDispatch, Episode } from '@/types/audio';

// Line 24 in reducer PLAY case: change durationSeconds to duration
case 'PLAY':
  return {
    ...state,
    currentEpisode: action.episode,
    isPlaying: true,
    isLoading: true,
    currentTime: 0,
    duration: action.episode.duration,
  };

// Lines 84, 126: change parameter type from EpisodeDetail to Episode
const play = useCallback((episode: Episode) => { ... });
const toggle = useCallback((episode: Episode) => { ... });
```

**Step 2: Update `EpisodeRow.tsx`**

Rename props: `subtitle` → `description`, `creator` → `creatorName`, `duration` remains string (caller formats it), `imageUrl` → `coverUrl`.

```typescript
interface EpisodeRowProps {
  readonly title: string;
  readonly description: string;
  readonly creatorName: string;
  readonly duration: string;
  readonly coverUrl?: string;
  readonly color: string;
  readonly isPlaying?: boolean;
  readonly onPlay?: () => void;
  readonly onTap?: () => void;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function EpisodeRow({ title, description, creatorName, duration, coverUrl, color, isPlaying = false, onPlay, onTap, className, style }: EpisodeRowProps) {
```

In the JSX, rename: `{subtitle}` → `{description}`, `{creator}` → `{creatorName}`, `{imageUrl && ...}` → `{coverUrl && ...}`, `src={imageUrl}` → `src={coverUrl}`.

**Step 3: Update `MiniPlayer.tsx`**

Rename field references: `currentEpisode.imageUrl` → `currentEpisode.coverUrl`, `currentEpisode.creator` → `currentEpisode.creatorName`.

**Step 4: Update `NowPlaying.tsx`**

This component currently uses `findEpisodeById` from hardcoded data. Change it to accept full episode data as a prop instead. The parent page will fetch and pass it.

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { ChevronLeftIcon } from '@/components/icons/ChevronLeftIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { PlayerControls } from '@/components/PlayerControls';
import { SourcesList } from '@/components/SourcesList';
import { formatDuration } from '@/lib/format';
import type { EpisodeWithSources } from '@/types/audio';


interface NowPlayingProps {
  readonly episode: EpisodeWithSources;
}

export function NowPlaying({ episode }: NowPlayingProps) {
  const router = useRouter();
  const { currentEpisode } = useAudioState();
  const { play } = useAudioDispatch();

  // Auto-play if navigating directly to this page and nothing is playing
  useEffect(() => {
    if (currentEpisode?.id !== episode.id) {
      play(episode);
    }
  }, [episode, currentEpisode?.id, play]);

  // Use the currently playing episode data if it matches, otherwise use the route episode
  const displayEpisode = currentEpisode?.id === episode.id ? currentEpisode : episode;

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${displayEpisode.color}15 0%, #fdfdf5 40%)`,
      }}
    >
      <div className="mx-auto w-full max-w-[428px] px-6 pt-4 pb-12">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="size-10 -ml-2 flex items-center justify-center text-[#111] mb-4 animate-fade-in"
        >
          <ChevronLeftIcon className="size-6" />
        </button>

        {/* Cover art */}
        <div className="flex justify-center mb-8 animate-scale-in anim-delay-1">
          <div
            className="relative w-[70%] aspect-square rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: displayEpisode.color }}
          >
            {displayEpisode.coverUrl && (
              <Image
                src={displayEpisode.coverUrl}
                alt={displayEpisode.title}
                fill
                className="object-cover opacity-80"
                priority
              />
            )}
          </div>
        </div>

        {/* Title & metadata */}
        <div className="mb-8 animate-fade-in anim-delay-2">
          <h1 className="font-serif font-bold text-2xl leading-tight text-[#111] mb-2">
            {displayEpisode.title}
          </h1>
          <p className="font-inter text-sm text-[#666]">
            {displayEpisode.creatorName} &middot; {formatDuration(displayEpisode.duration)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 animate-fade-in anim-delay-3">
          <ProgressBar />
        </div>

        {/* Controls */}
        <div className="mb-10 animate-fade-in anim-delay-4">
          <PlayerControls />
        </div>

        {/* Sources */}
        {'sources' in episode && (
          <div className="mb-4 animate-fade-in anim-delay-4">
            <SourcesList sources={episode.sources} />
          </div>
        )}

      </div>
    </div>
  );
}
```

**Step 5: Update `SourcesList.tsx`**

Change `Source` type import and rename `source.publisher` → `source.source`.

```typescript
import type { Source } from '@/types/audio';

// In JSX, line 45: change
<span className="font-inter text-xs text-[#666]">{source.source}</span>
```

**Step 6: `PlayerControls.tsx` and `ProgressBar.tsx`**

No changes needed — they already access `currentEpisode?.color` which stays the same field name.

**Step 7: Commit**

```bash
git add frontend/contexts/AudioContext.tsx frontend/components/MiniPlayer.tsx frontend/components/EpisodeRow.tsx frontend/components/NowPlaying.tsx frontend/components/SourcesList.tsx
git commit -m "refactor(frontend): update components for new Episode type"
```

---

### Task 4: Frontend — Update data/episodes.ts fallback to match new types

**Files:**
- Modify: `frontend/data/episodes.ts`

**Step 1: Update hardcoded data to match new `Episode` type**

```typescript
import type { Episode } from '@/types/audio';

export const FALLBACK_EPISODES: readonly Episode[] = [
  {
    id: 'ep-1',
    title: 'Rust vs Go in 2026: The Definitive Take',
    description: 'Rust / Go / Performance',
    creatorName: '@dev.alex',
    duration: 540,
    color: '#f54900',
    coverUrl: '/covers/rust-vs-go.png',
    audioUrl: '',
    isPublic: true,
    creatorId: '',
    publishedAt: '',
  },
  {
    id: 'ep-2',
    title: 'Quantum Computing Explained Simply',
    description: 'Quantum / Qubits / Google',
    creatorName: '@physics.dan',
    duration: 660,
    color: '#009689',
    coverUrl: '/covers/quantum.png',
    audioUrl: '',
    isPublic: true,
    creatorId: '',
    publishedAt: '',
  },
  {
    id: 'ep-3',
    title: 'Claude Code and the AI Coding Revolution',
    description: 'AI / Coding / Agents',
    creatorName: '@techie.sam',
    duration: 840,
    color: '#432dd7',
    coverUrl: '/covers/claude-coding.png',
    audioUrl: '',
    isPublic: true,
    creatorId: '',
    publishedAt: '',
  },
  {
    id: 'ep-4',
    title: 'Are Podcasts Dying or Evolving?',
    description: 'Media / Audio / Trends',
    creatorName: '@media.jan',
    duration: 480,
    color: '#155dfc',
    coverUrl: '/covers/death-podcasts.png',
    audioUrl: '',
    isPublic: true,
    creatorId: '',
    publishedAt: '',
  },
  {
    id: 'ep-5',
    title: 'The Science of Sleep & Productivity',
    description: 'Sleep / Focus / Deep Work',
    creatorName: '@sarah.k',
    duration: 600,
    color: '#ff637e',
    coverUrl: '/covers/sleep-science.png',
    audioUrl: '',
    isPublic: true,
    creatorId: '',
    publishedAt: '',
  },
] as const;
```

Remove `findEpisodeById`, `getDiscoverEpisodes`, `getRecentEpisodes` — no longer needed.

**Step 2: Commit**

```bash
git add frontend/data/episodes.ts
git commit -m "refactor(frontend): update fallback episodes to new Episode type"
```

---

### Task 5: Frontend — Wire up explore page to API

**Files:**
- Modify: `frontend/app/explore/page.tsx`

**Step 1: Replace hardcoded data with API fetch + fallback**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SearchInput } from '@/components/SearchInput';
import { EpisodeRow } from '@/components/EpisodeRow';
import { BottomNav } from '@/components/BottomNav';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { fetchEpisodes } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { FALLBACK_EPISODES } from '@/data/episodes';
import type { Episode } from '@/types/audio';

type LoadState = 'loading' | 'loaded' | 'fallback';

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [episodes, setEpisodes] = useState<readonly Episode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const { currentEpisode, isPlaying } = useAudioState();
  const { toggle, play } = useAudioDispatch();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchEpisodes()
      .then((result) => {
        if (cancelled) return;
        setEpisodes(result.episodes);
        setLoadState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setEpisodes(FALLBACK_EPISODES);
        setLoadState('fallback');
      });
    return () => { cancelled = true; };
  }, []);

  const hasPlayer = currentEpisode !== null;
  const isFallback = loadState === 'fallback';

  const filtered = episodes.filter(
    (ep) =>
      ep.title.toLowerCase().includes(search.toLowerCase()) ||
      ep.creatorName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-cream">
      <main className={`mx-auto w-full max-w-[428px] px-6 pt-6 ${hasPlayer ? 'pb-36' : 'pb-24'}`}>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6 animate-fade-in">
            <h1 className="font-serif text-4xl leading-10 text-[#111]">
              Discover
            </h1>
            <SearchInput value={search} onChange={setSearch} />
          </div>

          {isFallback && (
            <p className="font-inter text-xs text-[#999] text-center">
              Unable to load latest episodes. Showing demo data.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {loadState === 'loading' ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start pb-4 animate-pulse">
                  <div className="size-20 shrink-0 rounded-[10px] bg-[#111]/5" />
                  <div className="flex-1 pt-1 space-y-2">
                    <div className="h-4 bg-[#111]/5 rounded w-3/4" />
                    <div className="h-3 bg-[#111]/5 rounded w-1/2" />
                    <div className="h-3 bg-[#111]/5 rounded w-1/3" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="font-inter text-sm text-[#666] text-center py-8 animate-fade-in">
                No podcasts found.
              </p>
            ) : (
              filtered.map((ep, index) => (
                <EpisodeRow
                  key={ep.id}
                  title={ep.title}
                  description={ep.description}
                  creatorName={ep.creatorName}
                  duration={formatDuration(ep.duration)}
                  color={ep.color}
                  coverUrl={ep.coverUrl}
                  isPlaying={currentEpisode?.id === ep.id && isPlaying}
                  onPlay={isFallback ? undefined : () => toggle(ep)}
                  onTap={isFallback ? undefined : () => {
                    play(ep);
                    router.push(`/episode/${ep.id}`);
                  }}
                  className="animate-list-item"
                  style={{ animationDelay: `${100 + index * 60}ms` }}
                />
              ))
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
```

**Step 2: Verify**

Run: `cd frontend && npm run dev`
Open: `http://localhost:3000/explore`
Expected: See 3 seed episodes from API. If backend is down, see fallback demo data with "Unable to load" message and no play/tap interaction.

**Step 3: Commit**

```bash
git add frontend/app/explore/page.tsx
git commit -m "feat(frontend): wire explore page to /api/episodes with fallback"
```

---

### Task 6: Frontend — Wire up shows page to API

**Files:**
- Modify: `frontend/app/shows/page.tsx`

**Step 1: Replace hardcoded data with API fetch**

The shows page should call `/api/episodes/me` (user's own episodes). Since this requires auth, fall back to empty state if not logged in or API fails.

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { EpisodeRow } from '@/components/EpisodeRow';
import { useAudioState } from '@/hooks/useAudioState';
import { useAudioDispatch } from '@/hooks/useAudioDispatch';
import { request } from '@/lib/api';
import { formatDuration, episodeColor } from '@/lib/format';
import type { Episode } from '@/types/audio';

interface ApiEpisode {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  audio_url: string;
  duration: number;
  is_public: boolean;
  creator_id: string;
  creator_name: string;
  published_at: string;
}

interface ApiResponse {
  episodes: ApiEpisode[];
  total: number;
}

function toEpisode(raw: ApiEpisode): Episode {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
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

type LoadState = 'loading' | 'loaded' | 'error';

export default function ShowsPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const { currentEpisode, isPlaying } = useAudioState();
  const { toggle, play } = useAudioDispatch();
  const router = useRouter();

  const hasPlayer = currentEpisode !== null;

  useEffect(() => {
    let cancelled = false;
    request<ApiResponse>('/api/episodes/me')
      .then((data) => {
        if (cancelled) return;
        setEpisodes(data.episodes.map(toEpisode));
        setLoadState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <main className={`mx-auto w-full max-w-[428px] px-6 pt-6 ${hasPlayer ? 'pb-36' : 'pb-24'}`}>
        {/* Header */}
        <div className="flex flex-col gap-3 mb-10 animate-fade-in">
          <h1 className="font-serif text-4xl leading-10 text-[#111]">My Shows</h1>
          <p className="font-serif italic text-[14px] text-[#666] leading-5 opacity-70">
            Your saved AI-generated podcasts
          </p>
        </div>

        {/* Content */}
        <section>
          <h2 className="font-serif font-bold text-[14px] text-black/60 tracking-[1.4px] uppercase mb-4 animate-fade-in anim-delay-1">
            Recent
          </h2>
          <div className="flex flex-col gap-4">
            {loadState === 'loading' ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start pb-4 animate-pulse">
                  <div className="size-20 shrink-0 rounded-[10px] bg-[#111]/5" />
                  <div className="flex-1 pt-1 space-y-2">
                    <div className="h-4 bg-[#111]/5 rounded w-3/4" />
                    <div className="h-3 bg-[#111]/5 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : loadState === 'error' ? (
              <p className="font-inter text-sm text-[#666] text-center py-8 animate-fade-in">
                Sign in to see your podcasts.
              </p>
            ) : episodes.length === 0 ? (
              <p className="font-inter text-sm text-[#666] text-center py-8 animate-fade-in">
                No podcasts yet. Generate your first one!
              </p>
            ) : (
              episodes.map((ep, index) => (
                <EpisodeRow
                  key={ep.id}
                  title={ep.title}
                  description={ep.description}
                  creatorName={ep.creatorName}
                  duration={formatDuration(ep.duration)}
                  coverUrl={ep.coverUrl}
                  color={ep.color}
                  isPlaying={currentEpisode?.id === ep.id && isPlaying}
                  onPlay={() => toggle(ep)}
                  onTap={() => {
                    play(ep);
                    router.push(`/episode/${ep.id}`);
                  }}
                  className="animate-list-item"
                  style={{ animationDelay: `${200 + index * 60}ms` }}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
```

**NOTE:** The `toEpisode` adapter is duplicated here from `api.ts`. This is intentional for Task 6 — the shows page uses `request()` directly for `/api/episodes/me`, and the adapter is local. In a future cleanup, the shared `fetchEpisodes` helper could be extended with an `endpoint` parameter, but YAGNI for now.

Wait — actually this is bad. Let's NOT duplicate. Instead, export the adapter from `api.ts` and reuse it. In Task 2 Step 3, make sure `toEpisode` is exported:

```typescript
// In api.ts — change to export
export function toEpisode(raw: ApiEpisode): Episode { ... }
```

Then in shows page, import:
```typescript
import { request, toEpisode } from '@/lib/api';
```

And also export the `ApiEpisode` type so it can be used:
```typescript
export type { ApiEpisode };
```

Actually, simpler: add a `fetchMyEpisodes` helper in `api.ts` alongside `fetchEpisodes`:

```typescript
export async function fetchMyEpisodes(limit = 20, offset = 0): Promise<EpisodeListResult> {
  const data = await request<ApiEpisodeListResponse>(
    `/api/episodes/me?limit=${limit}&offset=${offset}`,
  );
  return {
    episodes: data.episodes.map(toEpisode),
    total: data.total,
  };
}
```

Then shows page just calls `fetchMyEpisodes()`. Much cleaner, no duplication.

**Step 2: Commit**

```bash
git add frontend/app/shows/page.tsx frontend/lib/api.ts
git commit -m "feat(frontend): wire shows page to /api/episodes/me"
```

---

### Task 7: Frontend — Wire up episode detail page to API

**Files:**
- Modify: `frontend/app/episode/[id]/page.tsx`
- Modify: `frontend/components/NowPlaying.tsx` (already done in Task 3)

**Step 1: Rewrite episode detail page to fetch from API**

Remove `generateStaticParams` and `dynamicParams = false`. Make it a client component that fetches episode detail.

```typescript
'use client';

import { useState, useEffect, use } from 'react';
import { fetchEpisodeDetail } from '@/lib/api';
import { NowPlaying } from '@/components/NowPlaying';
import type { EpisodeWithSources } from '@/types/audio';

export default function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [episode, setEpisode] = useState<EpisodeWithSources | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEpisodeDetail(id)
      .then((ep) => {
        if (!cancelled) setEpisode(ep);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-inter text-[#666]">Episode not found</p>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="size-8 border-2 border-[#111]/20 border-t-[#111] rounded-full animate-spin" />
      </div>
    );
  }

  return <NowPlaying episode={episode} />;
}
```

**Step 2: Verify**

Open: `http://localhost:3000/explore`
Click an episode → should navigate to `/episode/<uuid>` → shows detail page with sources.

**Step 3: Commit**

```bash
git add frontend/app/episode/[id]/page.tsx
git commit -m "feat(frontend): wire episode detail page to /api/episodes/:id"
```

---

### Task 8: Verify everything end-to-end

**Step 1: Run frontend lint + typecheck**

```bash
cd frontend && npx eslint . && npx tsc --noEmit
```

Fix any errors.

**Step 2: Run backend import check**

```bash
cd backend && python -c "from app.main import app; print('OK')"
```

**Step 3: Manual E2E test**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:3000/explore` — see 3 seed episodes from API
4. Click an episode → detail page loads with sources
5. Play/pause works
6. MiniPlayer shows correct info
7. Navigate to `/shows` — see my episodes (or "Sign in" message)
8. Stop backend → refresh explore page → see fallback demo data with disabled interaction

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: lint and type errors from episodes API integration"
```

---

### Task 9: Update documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/plans/2026-03-04-episodes-api-integration.md` (mark complete)

**Step 1: Update CLAUDE.md**

In the frontend section, update:
- Remove mention of "当前使用硬编码示例数据，待接入 API" from `app/explore/page.tsx` description
- Note that explore and shows pages now fetch from `/api/episodes`

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md — episodes pages now use API"
```
