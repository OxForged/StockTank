# API Contract

> Backend base URL: `https://your-podcast-production.up.railway.app`
> Frontend env: `NEXT_PUBLIC_API_URL`

## Entities

### User

| Field       | Type   | Notes                     |
| ----------- | ------ | ------------------------- |
| `id`        | uuid   | Primary key               |
| `name`      | string | Display name from OAuth   |
| `email`     | string | Unique, from OAuth        |
| `avatar_url`| string | Profile picture from OAuth|
| `created_at`| string | ISO 8601 UTC              |

### Episode

| Field          | Type      | Notes                                  |
| -------------- | --------- | -------------------------------------- |
| `id`           | uuid      | Primary key                            |
| `title`        | string    | Episode title                          |
| `keywords`     | string[]  | Topic keywords (e.g. ["AI", "Gaming"]) |
| `cover_url`    | string    | Square cover image URL (R2)            |
| `audio_url`    | string    | Public R2 URL to MP3                   |
| `duration`     | int       | Length in seconds                       |
| `is_public`    | bool      | Visible in public feed                 |
| `creator_id`   | uuid      | User who triggered generation          |
| `creator_name` | string    | Creator display name (from JOIN)       |
| `published_at` | string    | ISO 8601 UTC                           |
| `sources`      | Source[]  | Articles that went into this episode (detail only) |

### Source (nested in Episode detail)

| Field    | Type   | Notes                    |
| -------- | ------ | ------------------------ |
| `title`  | string | Article title            |
| `url`    | string | Link to original article |
| `source` | string | Feed name (e.g. "Hacker News") |

---

## Authentication

OAuth 2.0 (Google / GitHub). Backend issues a session token after OAuth callback.

### `GET /api/auth/{provider}`

Redirect to OAuth provider login page.

| Param      | Type   | Notes               |
| ---------- | ------ | -------------------- |
| `provider` | path   | `google` or `github` |

**Response:** `302` redirect to provider.

### `GET /api/auth/{provider}/callback`

OAuth callback. Sets session cookie and redirects to frontend.

### `GET /api/auth/me`

Get current user. Requires auth.

**Response `200`:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Albert",
  "email": "albert@example.com",
  "avatar_url": "https://...",
  "created_at": "2026-01-15T10:00:00Z",
  "stats": {
    "total_episodes": 12,
    "public_episodes": 8,
    "private_episodes": 4
  }
}
```

**Response `401`:** `{ "detail": "Not authenticated" }`

### `POST /api/auth/logout`

Clear session. Requires auth.

**Response `200`:** `{ "status": "ok" }`

---

## Onboarding

### `POST /api/onboarding/interests`

Submit user's interest topics during onboarding. Requires auth. Replaces any previously saved interests.

**Request body:**

```json
{
  "interests": ["AI", "芯片", "创业", "Apple", "电动车"]
}
```

| Field       | Type     | Notes                          |
| ----------- | -------- | ------------------------------ |
| `interests` | string[] | 1–10 topic strings, each max 50 chars |

**Response `200`:**

```json
{
  "interests": ["AI", "芯片", "创业", "Apple", "电动车"]
}
```

### `GET /api/onboarding/interests`

Get current user's saved interests. Requires auth.

**Response `200`:**

```json
{
  "interests": ["AI", "芯片", "创业", "Apple", "电动车"]
}
```

**Response `200` (no interests yet):**

```json
{
  "interests": []
}
```

---

## Endpoints

### `GET /api/health`

Health check. No auth required.

**Response `200`:**

```json
{ "status": "ok" }
```

---

### `GET /api/episodes`

Public feed — all public episodes, newest first. No auth required.

**Query params** (all optional):

| Param    | Type | Default | Description         |
| -------- | ---- | ------- | ------------------- |
| `limit`  | int  | 20      | Max items to return |
| `offset` | int  | 0       | Pagination offset   |

**Response `200`:**

```json
{
  "episodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "科技早报 — 2026年3月1日",
      "keywords": ["AI", "Tech", "Gaming"],
      "cover_url": "https://r2-public-url/covers/550e8400.jpg",
      "audio_url": "https://r2-public-url/episodes/550e8400.mp3",
      "duration": 360,
      "is_public": true,
      "creator_id": "...",
      "creator_name": "Albert",
      "published_at": "2026-03-01T08:00:00Z"
    }
  ],
  "total": 42
}
```

---

### `GET /api/episodes/me`

Current user's episodes (public + private). Requires auth.

**Query params:** same as `/api/episodes`.

**Response `200`:** same shape as `/api/episodes`.

---

### `GET /api/episodes/{id}`

Single episode with full detail (sources). No auth required for public episodes; auth required for private episodes owned by the user.

**Response `200`:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Tech News -- March 1, 2026",
  "keywords": ["AI", "Tech", "Gaming"],
  "cover_url": "https://r2-public-url/covers/550e8400.jpg",
  "audio_url": "https://r2-public-url/episodes/550e8400.mp3",
  "duration": 360,
  "is_public": true,
  "creator_id": "...",
  "creator_name": "Albert",
  "published_at": "2026-03-01T08:00:00Z",
  "sources": [
    { "title": "Article title", "url": "https://...", "source": "Hacker News" }
  ]
}
```

**Response `404`:** episode not found or private episode not owned by user.

---

### `POST /api/generate`

Trigger podcast generation. Requires auth. The episode is owned by the current user.

**Request body** (all optional):

```json
{
  "feeds": ["https://techcrunch.com/feed/"],
  "keywords": ["AI", "Science"],
  "date": "2026-03-05"
}
```

| Field      | Type     | Notes                                                        |
| ---------- | -------- | ------------------------------------------------------------ |
| `feeds`        | string[] | Override RSS feed URLs (ignored if `keywords` is set)        |
| `keywords`     | string[] | Keyword-driven mode: fetch from curated RSS sources per keyword |
| `date`         | string   | Episode date tag (YYYY-MM-DD, defaults to today)             |
| `voice_male`   | string   | Override male voice name (default: from env)                 |
| `voice_female`  | string   | Override female voice name (default: from env)               |

When `keywords` is provided, the pipeline fetches articles from keyword-mapped RSS sources
(configured in `config/rss_sources.json`) and uses Gemini to select the most relevant articles.
When omitted, the legacy flow is used (static feeds + user interests).

**Response `202`:**

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Generation started"
}
```

---

### `GET /api/tasks/{task_id}`

Poll generation progress. Requires auth (only task owner can view).

**Response `200`:**

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending | processing | completed | failed",
  "progress": "Generating script...",
  "episode_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field        | Type   | Notes                                           |
| ------------ | ------ | ----------------------------------------------- |
| `task_id`    | uuid   | Unique task identifier                          |
| `status`     | enum   | `pending`, `processing`, `completed`, `failed`  |
| `progress`   | string | Human-readable step description                 |
| `episode_id` | uuid   | Present only when `status` is `completed`       |

---

## Frontend Tabs → API Mapping

| Tab              | Endpoint              | Auth required |
| ---------------- | --------------------- | ------------- |
| Public feed      | `GET /api/episodes`   | No            |
| My podcasts      | `GET /api/episodes/me`| Yes           |
| Profile/Settings | `GET /api/auth/me`    | Yes           |

---

## Design Decisions

| Decision         | Choice                          | Rationale                                    |
| ---------------- | ------------------------------- | -------------------------------------------- |
| IDs              | UUID v4                         | Multi-user, multiple episodes per day        |
| Auth             | OAuth 2.0 (Google/GitHub)       | No password storage, simple UX               |
| Session          | HTTP-only cookie                | Secure, no token management on frontend      |
| Episode visibility | `is_public` flag              | Public feed + private episodes in one model  |
| Async generation | Polling (`/api/tasks`)          | Simpler than SSE/WebSocket to start          |
| Pagination       | `limit` / `offset`              | Simple; switch to cursor-based if needed     |
| Episode detail   | Separate endpoint with sources   | Keep list response lightweight     |
| Date format      | ISO 8601 UTC                    | Standard, no timezone ambiguity              |
