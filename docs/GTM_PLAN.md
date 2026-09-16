# StockTank — Go-To-Market & Build Plan (working draft)

Status: **paused at planning checkpoint** (2026-09-16). Nothing committed or pushed yet.
Source of truth for scope: `README.md` (master build prompt, sections 1–59).
Design direction: `stocktankexample.png`.

---

## 1. What exists in this repo

| Folder | Role as a StockTank building block (to be confirmed by audit) |
|---|---|
| `ai-video-editor-main` | Browser video editor / timeline, captions, TTS, effects → clipping UI, media tooling |
| `nft-video-gen-main` | Video generation pipeline → media-worker / avatar rendering reference |
| `your-podcast-main` | Podcast app → episode/show pages, player, RSS, AI summaries |
| `CreatorOS-main` | Creator tooling → creator platform, content factory, admin |
| `metarealm-growth-os-main` | Growth/marketing OS → marketing intelligence, social distribution |
| `minds-orchestrator-client-main` | Agent orchestration client → narrow internal AI agents (§55) |
| `minds-reward-main` | Rewards/points → community & optional web3 layer |
| `nft-assets-server-main` | Asset server → media assets / S3 serving |
| `x-relay-main` | X (Twitter) relay → X DistributionProvider adapter |

Component audits (license, reusable modules with file paths, hard-coded secrets, quality)
were started with Fable subagents; results get added to section 7 below when they finish.

**Before copying anything:** check each folder's LICENSE and remove any hard-coded keys.

---

## 2. Brand tokens (from `stocktankexample.png`)

- Background: deep navy/near-black `#070D14` → surface `#0D1722`, hairline `#1B2A38`
- Primary: emerald gradient `#00C97A` → `#1EF0A8`
- Text: `#F2F5F7` primary, `#8A9AA8` secondary
- Wordmark: heavy, wide, slightly slanted display type; "STOCK" white, "TANK" green
- Tagline: `ON-CHAIN STOCKS & CRYPTO` in wide-tracked caps
- Marks: hex "S" with rising bars (primary), bull head with bars (alt), minimal bars+arrow
- Light theme to be derived (§5 requires dark/light)

---

## 3. Local toolchain (checked)

| Tool | Status |
|---|---|
| Node | v24.20.0 ✅ |
| pnpm | 11.25.0 ✅ |
| Docker | 29.7.2, daemon running ✅ |
| git | 2.55 ✅; remote `github.com/OxForged/StockTank` |
| gh CLI | installed, **not logged in** ⛔ (run `! gh auth login`) |
| ffmpeg | **missing** (fine: runs inside the media-worker container) |
| psql / redis | not installed locally (fine: run in Docker Compose) |
| Hosting CLI | none installed. **Hosting target still to be decided** |

---

## 4. Go-to-market plan (step by step)

The README's 12 milestones are the engineering order. GTM puts them into launch
gates, so a real public product ships early and AI/mobile/TV follow behind feature flags.

### Phase 0: Decisions & accounts (blocking, owner: you)
1. `gh auth login` and confirm push access to `OxForged/StockTank`.
2. Pick production hosting (recommendation: one VPS/Hetzner or Fly/Railway for API+workers,
   managed Postgres, Cloudflare R2 for S3+CDN, Cloudflare in front for DNS/TLS).
3. Domain + DNS access.
4. Accounts/keys: Anthropic (AI), S3/R2, email (Resend/Postmark), PostHog, Sentry.
5. Legal review of positioning: informational media only, not investment advice (§48).
6. Decide whether component folders stay in the repo (move to `/reference` or delete after extraction).

### Phase 1: Foundation (Milestone 1), gate: "it runs"
- pnpm + Turborepo monorepo per §3; `docker-compose.dev.yml` (Postgres, Redis, Meilisearch, MinIO)
- `services/api` Express+TS+Zod, `/api/v1`, `/health` `/ready` `/version`, OpenAPI
- `packages/database` Prisma schema (core tables §6–8), migrations, DEMO seed (§52)
- Auth (sessions + RBAC), rate limiting, CORS, audit log
- `packages/ui` design system w/ tokens above; `apps/web` shell; `apps/admin` shell
- GitHub Actions: lint, typecheck, test, build
- **Exit:** CI green, `docker compose up` boots everything, login works end to end

### Phase 2: Content + public site (Milestones 2 + 6-lite), gate: private beta
- Shows / episodes / hosts / guests / projects / companies CRUD in admin
- Homepage (§5 editorial layout), show, episode, project, company, creator pages
- Meilisearch grouped search + autocomplete
- Legal pages + financial disclaimer, SEO (OG, JSON-LD, sitemap, robots)
- PostHog analytics adapter, Sentry
- **Exit:** staging deployed; team can publish real content; E2E: signup, login, search, follow, bookmark

### Phase 3: Media + podcast (Milestones 3 + 4), gate: public launch v0.1
- Upload → S3 → BullMQ → FFmpeg → HLS/thumbnails/audio (reuse from video components)
- Web audio/video players (HLS), continue listening
- Castopod adapter + RSS; submit feeds to Apple/Spotify
- **Launch:** first show and 3 to 5 episodes live, landing + waitlist/newsletter, X/YouTube channels
- **Exit:** production deploy, backups with a tested restore, uptime monitoring

### Phase 4: Live (Milestone 5)
- AzuraCast adapter, Live page, now-playing, live badge on the homepage

### Phase 5: AI production (Milestone 7), behind feature flags
- AI service + LLMProvider (Anthropic first), transcription adapter
- Content factory: summary, show notes, chapters, SEO, clip candidates → **review queue**
- AI personalities + RAG with citations; AI cost tracking and budgets (§49)

### Phase 6: Distribution + growth (Milestone 8)
- DistributionProvider: X (from `x-relay`), YouTube, TikTok, Instagram, Facebook
- Marketing intelligence, newsletter, push/email notifications

### Phase 7: Monetization (Milestone 11)
- Advertisers, campaigns, placements, sponsorships; creator program

### Phase 8: Mobile + TV (Milestones 9–10)
- Expo app on the same API; TV app on HLS with remote navigation

### Continuous (Milestone 12)
- Security review, load test, E2E suite, staging → production promotion with manual approval

---

## 5. Production launch checklist (v0.1)
- [ ] CI green on main; staging == production config
- [ ] Secrets only in env / secret manager; `.env.example` complete
- [ ] DB backups scheduled **and restore tested**
- [ ] Sentry + uptime + `/health` monitoring
- [ ] Legal pages + disclaimers live
- [ ] All seed data removed or labeled DEMO
- [ ] Rate limits, CORS, secure cookies verified
- [ ] RSS validated; OG cards verified
- [ ] Rollback procedure documented

---

## 6. Open blockers
1. GitHub auth (`gh auth login`)
2. Hosting / domain / provider accounts (Phase 0)
3. Component audit results (section 7)

## 7. Component audit results
_Pending: Fable audits running._
