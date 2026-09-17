# StockTank — session log

## 2026-09-16 → 17

### Done (pushed to `main`)
| Commit | What |
|---|---|
| `3bbecb0`, `5d7011b` | GTM plan, component audits, reuse map, `CLAUDE.md` security notes |
| (history rewrite) | `reference/nft-assets-server-main/test_nonce.js` (leaked Alchemy key + wallet key) purged from all history. **Keys must still be rotated before production.** |
| `132d2b9` | Monorepo scaffold, Docker dev infra, Prisma schema + init migration, shared types, api-client |
| `fb9c137` | CI + security workflow, production software guide |
| `2d40655` | Milestone 1: API (auth, RBAC, CSRF, rate limits, audit, OpenAPI, 41 tests), design system, web + admin shells; fix for API startup crash (rate-limit key generator) |
| `dfd52d5` | Contracts for advertising, marketing, live schedule and public content (Prisma models + migration, Zod types, `sales` role) |

### Design
Interactive design canvas: https://claude.ai/artifact/9vcvfKgo6qNxKdTthrfgT3
- Concept A "Tank Floor", Concept B "The Desk", and the **Hybrid A + B**, which is the target for `apps/web`
- The owner prefers Concept B's left navigation rail and the MARKETS ticker tape

### Done: "Hybrid build + marketing + selling ad spots" (built solo, no subagents)
| Commit | What |
|---|---|
| `2181b9f` | Local-only one-click staff sign-in (`DEV_LOGIN_ENABLED`) |
| `a585b5d` | Fix black screen: apps read workspace packages from source in dev |
| `a6a6f96` | API: public content, ad serving and tracking, media kit, leads, newsletter, ads admin; seeds; OpenAPI (49 paths); 85 API tests |
| `b8486ef` | Web: hybrid A + B site, ad slots, `/advertise`, newsletter pages, data-backed shows/projects/companies/search/live; 17 web tests |
| `48d895f` | Admin: advertising overview, advertisers, campaigns, review queue, rate card, leads, newsletter audience, feature flags; 8 admin tests |
| `a6223b0` | `docs/marketing/GO_TO_MARKET_AND_AD_SALES.md` playbook |
| `6506dd5` | API: content CMS (shows, episodes, projects, companies, articles, live schedule) + viewer library (follows, bookmarks); 90 API tests |
| `16fb34f` | Admin CMS pages (config-driven editor) + account-synced watchlist and `/library` on the site |
| `ac80d6c` | API: Meilisearch search (fallback to Postgres), suggest/trending, media-graph detail endpoints, hosts/guests CMS, sitemap/RSS/robots; 98 API tests |
| `1f3d95c` | Web: episode/project/company/person/news pages, SEO metadata + JSON-LD, richer search; admin hosts/guests + reindex; web 22, admin 9 tests |

| `0e04a14` | Milestone 2 wrap-up (graph pages, search, SEO) |

### Done: Milestone 3, media pipeline
| Commit | What |
|---|---|
| `127817c` | `packages/media` (S3 storage, FFmpeg command builders), `services/media-worker` (BullMQ + FFmpeg), admin media/clip API, public episode and clip media, hls.js episode player, real mini player |
| (this commit) | Admin Videos (presigned uploads with progress, processing status, retry), Clips (cut, review, render 16:9/9:16/1:1) and Shorts; worker Dockerfile; `pnpm media:bucket` |

Verified live on localhost: an 8s 720p upload went through presigned PUT → complete → worker → HLS 720p/480p + audio-only + MP3 + poster served from MinIO; the demo episode switched to it. A clip rendered to a 1080×1920 vertical MP4. Originals return 403 publicly; renditions are readable. Tests: media 16, worker 6 (real FFmpeg), API 104, web 23, admin 15.

| `952883e` | Docker builds fixed (Prisma generate placeholder URL); worker image verified running with distro FFmpeg |

### Done: Milestone 4, podcast distribution
| Commit | What |
|---|---|
| (this commit) | `packages/podcast`: RSS builder (Apple + Podcasting 2.0, DEMO feeds blocked, disclaimers) and Castopod REST v1 adapter; show podcast settings + episode type/sync schema; public `/podcasts/<slug>/feed.xml`; admin Podcasts & RSS (settings, feed URL, directory warnings, episode types, send to Castopod); worker `podcast-sync` job; MP3 byte size recorded for enclosures; show page RSS link + `<link rel="alternate">` |

Verified live on localhost: the demo "Founder Floor" feed is well-formed XML through the web origin, labeled DEMO with `itunes:block`, and its enclosure length matches the MP3's real Content-Length. Castopod is not running locally, so its adapter is covered by contract tests against Castopod's documented REST API (create episode multipart + publish), not a live instance.

### Done: Milestone 5, live radio
| Commit | What |
|---|---|
| (this commit) | `packages/radio` AzuraCast adapter (§12 methods; API key only for management endpoints; listener counts only, never listener records); `radio_stations` table; public `/api/v1/live/radio` with a shared now-playing cache (10s fresh, 5 min stale-while-down, deduped fetches); admin Stations + Now Playing (health, playlists, setup notices); web StockTank Radio on /live and live listening in the mini player |

Not verified against a live AzuraCast: none runs locally and AzuraCast's public demo returned HTTP 521 during this session. Coverage is contract tests built from AzuraCast's documented now-playing payload, plus API/web/admin tests. First real station setup should confirm the payload mapping.

### Next
- Owner decisions: prices and packages, legal review of drafts, production email provider, hosting/domain, PODCAST_OWNER_EMAIL, cover art for shows, AzuraCast server
- Milestone 6: analytics, roles/permissions UI, API keys, audit log viewer
- Milestone 5: AzuraCast live radio; 6: analytics, roles, API keys, audit viewer; 7: AI services

### Run locally
```bash
pnpm install
bash scripts/dev-setup.sh        # infra, migrations, seeds (dev + test DB)
pnpm dev                         # API :4000, web :5190, admin :5181, media worker
pnpm media:bucket                # once: MinIO bucket (renditions public, originals private)
pnpm db:seed:demo                # optional: DEMO shows, projects, companies, rundown
```
Admin: `admin@stocktank.local`, password is `SEED_ADMIN_PASSWORD` in `.env` (gitignored).
