# What you need to put StockTank into production

Split into (A) what goes on **your Windows PC**, (B) **accounts/services** to sign up for, and
(C) what runs on the **production server**. You do *not* install Postgres, Redis, FFmpeg, etc. on
your PC: they run in Docker locally and on the server or as managed services in production.

## A. Install on this computer

| Software | Why | Status on this PC |
|---|---|---|
| Git | Version control | ✅ installed (2.55) |
| GitHub CLI (`gh`) | PRs, releases, secrets | ✅ installed, logged in |
| Node.js 24 LTS | Build and run the apps | ✅ installed (24.20) |
| pnpm 11 | Monorepo package manager | ✅ installed (11.25) |
| Docker Desktop | Local Postgres/Redis/Meilisearch/MinIO; builds production images | ✅ installed (29.7) |
| VS Code (or any editor) | Development | ✅ present |
| **Deploy CLI for your chosen host** | Push releases | ⛔ pick one: `flyctl` (Fly.io), `railway`, or SSH for a VPS |
| **Cloudflare `wrangler`** (optional) | R2 buckets / DNS via CLI | ⛔ optional: `pnpm add -g wrangler` |
| **Expo / EAS CLI** (Phase 8 only) | Build iOS/Android apps | later: `pnpm add -g eas-cli` |
| **Xcode** (Phase 8, iOS) | Requires a Mac, or use EAS cloud builds | later |
| **Android Studio** (Phase 8) | Android emulator | later |

Nothing else is required locally: FFmpeg, Postgres, Redis and Meilisearch run inside containers.

## B. Accounts and services (production)

| Need | Recommended | Alternatives |
|---|---|---|
| Domain + DNS + CDN + TLS | **Cloudflare** | Route 53 |
| App hosting (API, workers, web) | **Fly.io** or a **Hetzner VPS** running Docker Compose | Railway, Render, AWS ECS |
| Managed PostgreSQL | **Neon** or **Supabase Postgres** or Fly Postgres | AWS RDS |
| Managed Redis | **Upstash Redis** | Redis Cloud, self-hosted |
| Object storage (media, HLS) | **Cloudflare R2** (no egress fees) | AWS S3, Backblaze B2 |
| Search | **Meilisearch Cloud** | self-hosted container |
| Podcast hosting / RSS | **Castopod** (self-hosted container) | |
| Live radio | **AzuraCast** (self-hosted on its own VPS) | |
| Error tracking | **Sentry** | |
| Product analytics | **PostHog** | |
| Uptime monitoring | **Better Stack** or UptimeRobot | |
| Transactional email | **Resend** or Postmark | SES |
| AI (Phase 5) | **Anthropic API** | OpenAI (via adapter) |
| Transcription (Phase 5) | Deepgram / AssemblyAI / self-hosted Whisper | |
| Push notifications (Phase 6) | Expo Push + Web Push (VAPID) | |
| Social APIs (Phase 6) | X developer account, YouTube Data API, Meta, TikTok | |
| Secrets | Host's secret store (Fly secrets, Doppler, 1Password) | |
| Backups | Provider PITR + nightly `pg_dump` to R2 | |

## C. What runs in production (containers)

- `stocktank-api` (Node 24, this repo's `services/api/Dockerfile`)
- `stocktank-web`, `stocktank-admin` (static builds behind Cloudflare, or nginx containers)
- `media-worker` with FFmpeg (Phase 3)
- Castopod, plus AzuraCast (Phases 3–4)
- Traefik or nginx reverse proxy (if on a VPS)

## Before the first production deploy
1. **Rotate the leaked Alchemy key and wallet** (see `CLAUDE.md`).
2. Generate a new `SESSION_SECRET` for production only.
3. Create separate staging and production databases.
4. Test a database restore from backup.
