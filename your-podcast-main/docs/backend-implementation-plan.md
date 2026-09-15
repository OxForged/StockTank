# Backend Implementation Plan

> ⚠️ **DEPRECATED** — 2026-03-04
> All phases (1–9) have been fully implemented. This document is kept for historical reference only.
> For current architecture, see `CLAUDE.md` and `docs/architecture-decision.md`.

> Based on: API contract, UX plan, architecture-decision.md, CLAUDE.md
> Current state: FastAPI shell with `/api/health` only

---

## Phase 1: Foundation

Everything else depends on this. No API routes can work without config, models, and database.

### Step 1.1: Add dependencies to `pyproject.toml`

Add all required packages:

- **Core**: `sqlmodel`, `pydantic-settings`, `python-dotenv`
- **Auth**: `authlib`, `httpx`, `itsdangerous` (OAuth + session)
- **Services**: `feedparser`, `google-generativeai`, `zhipuai`, `boto3`, `pydub`
- **Utilities**: `python-multipart`

Run `uv lock` to regenerate `uv.lock`.

### Step 1.2: Create `app/config.py`

Pydantic Settings class loading from env vars:

```python
class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///data/podcast.db"

    # Auth
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    session_secret: str = "change-me"
    frontend_url: str = "http://localhost:3000"

    # Services
    gemini_api_key: str = ""
    glm_api_key: str = ""

    # R2 Storage
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_url: str = ""
```

Update `.env.example` to match.

### Step 1.3: Create `app/models.py`

SQLModel models matching the API contract entities:

- **User** — `id` (uuid), `name`, `email` (unique), `avatar_url`, `provider` (google/github), `provider_id`, `interests` (JSON string list), `created_at`
- **Episode** — `id` (uuid), `title`, `keywords` (JSON array), `cover_url`, `audio_url`, `duration`, `is_public`, `creator_id` (FK -> User), `published_at`
- **Source** — `id` (uuid), `episode_id` (FK → Episode), `title`, `url`, `source`
- **TranscriptLine** — `id` (uuid), `episode_id` (FK → Episode), `order` (int), `speaker`, `text`
- **Task** — `id` (uuid), `user_id` (FK → User), `status` (enum: pending/processing/completed/failed), `progress` (str), `episode_id` (nullable FK → Episode), `created_at`

### Step 1.4: Database initialization

- Create `app/database.py` — SQLModel engine + session dependency
- Create tables on app startup via `SQLModel.metadata.create_all`
- Store SQLite file at `data/podcast.db` (gitignored)
- Add `data/` to `.gitignore` and `.dockerignore`

---

## Phase 2: Authentication

Required before any user-scoped endpoint.

### Step 2.1: OAuth routes

Create `app/routers/auth.py`:

- `GET /api/auth/google` — redirect to Google OAuth
- `GET /api/auth/google/callback` — exchange code, upsert User, set session cookie, redirect to frontend
- `GET /api/auth/github` — redirect to GitHub OAuth
- `GET /api/auth/github/callback` — same flow
- Use `authlib` for OAuth flow
- Session: signed cookie via `itsdangerous` (simple, no Redis needed)

### Step 2.2: Session middleware + auth dependency

- Create `app/auth.py` — `get_current_user` dependency that reads session cookie, returns User or raises 401
- Create `get_optional_user` variant that returns User or None (for public endpoints)

### Step 2.3: User endpoints

- `GET /api/auth/me` — return current user + stats (episode counts via subquery)
- `POST /api/auth/logout` — clear session cookie

### Step 2.4: Update `.env.example`

Add OAuth client ID/secret and session secret vars.

---

## Phase 3: Onboarding

Simple — just save/retrieve interest topics per user.

### Step 3.1: Onboarding routes

Create `app/routers/onboarding.py`:

- `POST /api/onboarding/interests` — validate 1-10 strings (max 50 chars each), save to `user.interests` as JSON
- `GET /api/onboarding/interests` — return current user's interests

Both require auth.

---

## Phase 4: Episodes CRUD

The core read endpoints. No generation logic yet — just the API to list and view episodes.

### Step 4.1: Episode routes

Create `app/routers/episodes.py`:

- `GET /api/episodes` — list public episodes, newest first, with `limit`/`offset` pagination. Join User to include `creator: { name, avatar_url }` in response. Return `{ episodes, total }`.
- `GET /api/episodes/me` — list current user's episodes (public + private). Requires auth. Same response shape.
- `GET /api/episodes/{id}` — single episode with full detail: sources + transcript. Public episodes: no auth. Private episodes: auth required, must be owner.

### Step 4.2: Response schemas

Create `app/schemas.py` (Pydantic models for API responses):

- `EpisodeListItem` — id, title, description, cover_url, audio_url, duration, is_public, creator_id, creator (name + avatar_url), published_at
- `EpisodeDetail` — extends list item with sources[] and transcript[]
- `EpisodeListResponse` — episodes[] + total
- `UserResponse` — id, name, email, avatar_url, created_at, stats
- `TaskResponse` — task_id, status, progress, episode_id

---

## Phase 5: Service Layer (Podcast Generation Pipeline)

Build each service independently, then wire them together.

### Step 5.1: RSS fetching — `app/services/rss.py`

- Input: list of RSS feed URLs
- Use `feedparser` to fetch and parse
- Output: list of article dicts `{ title, url, summary, source, published }`
- Handle feed errors gracefully (skip broken feeds)

### Step 5.2: Gemini filtering — `app/services/gemini.py`

- Input: list of articles + user interests
- Call Gemini API to rank/filter articles, pick top 8-10
- Output: filtered list of articles
- Prompt should consider user's interest topics for relevance

### Step 5.3: Script generation — `app/services/podcast.py`

- Input: filtered articles
- Use Podcastfy or Gemini prompt to generate a two-host dialogue script (小明 + 小红)
- Output: list of `{ speaker, text }` lines

### Step 5.4: TTS synthesis — `app/services/tts.py`

- Input: script lines
- Call GLM TTS API per line (小明 = male voice, 小红 = female voice)
- Output: list of audio file paths (temp files)
- Must handle: rate limiting, retries on failure, cleanup of temp files

### Step 5.5: Audio merging — `app/services/audio.py`

- Input: list of audio file paths
- Use pydub/ffmpeg to concatenate into single MP3
- Output: final MP3 file path

### Step 5.6: Cover image generation — `app/services/cover.py`

- Input: episode title / topics
- Generate or select a cover image (could use Gemini image gen, or template-based with text overlay)
- Output: image file path
- MVP alternative: use a set of pre-made cover templates, pick based on hash of title

### Step 5.7: R2 upload — `app/services/storage.py`

- Input: file path + target key
- Upload to R2 via boto3 (S3-compatible)
- Output: public URL
- Used for both MP3 and cover image uploads

---

## Phase 6: Generation Endpoint + Background Tasks

Wire the pipeline together behind the async generate endpoint.

### Step 6.1: Pipeline orchestrator — `app/services/pipeline.py`

Single function that runs the full pipeline:

1. Fetch RSS feeds
2. Filter with Gemini (using user's interests)
3. Generate script
4. Synthesize TTS
5. Merge audio
6. Generate/select cover image
7. Upload MP3 + cover to R2
8. Create Episode + Sources + TranscriptLines in DB
9. Update Task status at each step

Takes a `task_id` and updates `task.progress` at each stage.

### Step 6.2: Background task execution

Create `app/routers/generate.py`:

- `POST /api/generate` — requires auth, creates a Task record (status=pending), launches pipeline in background (FastAPI `BackgroundTasks`), returns `{ task_id, status, message }` with 202
- Enforce: one active task per user at a time

### Step 6.3: Task polling endpoint

Create `app/routers/tasks.py`:

- `GET /api/tasks/{task_id}` — requires auth, must be task owner, return current task status/progress/episode_id

---

## Phase 7: CLI + Automation

### Step 7.1: CLI script — `generate.py`

- Standalone script that imports and runs the pipeline directly
- Accepts optional args: `--date`, `--user-id`
- For cron/manual use outside the API

### Step 7.2: GitHub Actions cron workflow

- `.github/workflows/daily-podcast.yml`
- Runs daily, calls `POST /api/generate` with a service account or API key
- Or: runs `generate.py` directly via Railway CLI

---

## Phase 8: Litestream Backup

### Step 8.1: Litestream configuration

- Add `litestream.yml` config pointing to R2
- Modify Dockerfile to install Litestream and run it alongside uvicorn
- Continuous SQLite replication to R2 bucket

---

## Phase 9: Integration Testing + Hardening

### Step 9.1: Seed data script

- Script to insert sample episodes with sources + transcript for frontend development
- Useful while frontend is being built

### Step 9.2: Error handling

- Consistent error response format across all endpoints
- Retry logic in TTS service (most failure-prone step)
- Timeout handling for Gemini and GLM API calls

### Step 9.3: Update Dockerfile + deploy

- Ensure all new dependencies are in the Docker build
- Add new env vars to Railway dashboard
- Test full deployment

---

## Implementation Order Summary

| Phase | What | Depends on | Estimated complexity |
|-------|------|------------|---------------------|
| 1 | Foundation (config, models, DB) | nothing | Low |
| 2 | Auth (OAuth, sessions) | Phase 1 | Medium |
| 3 | Onboarding (interests) | Phase 2 | Low |
| 4 | Episodes CRUD (list, detail) | Phase 1 | Low |
| 5 | Service layer (RSS → TTS → R2) | Phase 1 | High |
| 6 | Generate endpoint + tasks | Phase 2, 4, 5 | Medium |
| 7 | CLI + GitHub Actions cron | Phase 5 | Low |
| 8 | Litestream backup | Phase 1 | Low |
| 9 | Testing + hardening | All above | Medium |

Phases 3, 4, and 5 can be worked on in parallel after Phase 1 is done.
Phases 2 and 4 are needed before the frontend can integrate.
