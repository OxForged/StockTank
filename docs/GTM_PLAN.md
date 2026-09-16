# StockTank — Go-To-Market & Build Plan (working draft)

Status: **Phase 1 in progress** (2026-09-16). Component audits complete (section 7).
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
0. **Leaked credentials:** `nft-assets-server-main/test_nonce.js` was purged from git history on 2026-09-16 (force-pushed). The wallet key and Alchemy key were public before that, so **rotate them before production** (the owner has committed to this).
1. ~~GitHub auth~~ done (`OxForged`)
2. Hosting / domain / provider accounts (Phase 0)
3. ~~License permission~~: the owner confirmed full permission for every component folder.
4. Revoke the session token in `nft-video-gen-main/scripts/test-mindname-display.mjs:4`.

## 7. Component audit results

### your-podcast-main
- **What:** AI-generated two-host tech news podcast. RSS ingest → LLM filter → script → TTS → ffmpeg → R2.
- **Stack mismatch:** Python 3.11/FastAPI backend (D1/SQLite + Alembic); Next.js 16 / React 19 / Tailwind v4 frontend.
- **License:** no LICENSE file (README only *says* MIT). Treat it as unlicensed until the author confirms.
- **Reuse (player: the most valuable part):**
  - `frontend/contexts/AudioContext.tsx` → adapt → `packages/player`. Remove the fake playback timer at lines 69-82, 97-101 and 120-123.
  - `frontend/components/ProgressBar.tsx` → copy → `packages/player` (accessible slider).
  - `PlayerControls.tsx`, `MiniPlayer.tsx`, `NowPlaying.tsx` → adapt: swap `next/*` for React Router and hex colors for tokens.
  - `hooks/useAudioState.ts`, `hooks/useAudioDispatch.ts`, `types/audio.ts`, `lib/format.ts`, `components/icons/*` → copy.
  - `EpisodeRow.tsx`, `SourcesList.tsx`, `SearchInput.tsx` → adapt → `apps/web`.
  - `app/globals.css` → adapt: keep the keyframes and reduced-motion rules; drop the cream editorial theme.
- **Reference only (port Python → Node):**
  - `services/tts.py`: chunking, 429 backoff, voice per speaker.
  - `services/llm/prompts.py`: title, keywords, filter prompts.
  - `services/pipeline.py`: job-step pattern for BullMQ.
  - `routers/generate.py` + `tasks.py`: 202-then-poll API and 409 for one active job per user.
- **Missing (build from scratch):** RSS feed *generation*, iTunes namespace, HLS, video, uploads, speech-to-text transcription.
- **Secrets / URLs:** no keys committed. Hard-coded values to remove:
  - Vercel origin at `backend/app/main.py:52`
  - LAN IP at `frontend/next.config.ts:16`
  - Seed email at `routers/auth.py:121`
- **Don't reuse:**
  - The Python backend
  - D1/SQLite/Alembic
  - Next pages and config, Vercel/Railway workflows
  - Onboarding UI
  - `rss_sources.json`
  - Google-only cookie auth
  - `frontend/data/episodes.ts` fake fallback episodes
  - Auto dev-login

### minds-orchestrator-client-main (MIT)
- **What:** zero-dependency ESM client for the Animoca Minds API, plus a `runChain` staged pipeline. Has 27 offline tests.
- **Reuse:**
  - `src/orchestrate.mjs` → adapt to TS → `services/ai-service/src/orchestration/pipeline.ts`. Its Stage type (prompt, parse, timeout, optional, resume) fits the §55 agents; types are in `index.d.ts:53-98`.
  - `src/client.mjs:184-230` (tolerant JSON extraction, HTML strip) → copy → `services/ai-service/src/llm/parse.ts`.
- **Don't reuse:** the Minds transport, `examples/forkcast-oracle.mjs`.

### minds-reward-main (MIT)
- **What:** ERC-20 reward token + mint-on-claim distributor for Base. Hardhat 3, OpenZeppelin 5.6, about 2,800 lines of tests, a coverage gate and CI.
- **Reuse:**
  - `contracts/{Operable,RewardToken,RewardDistributor}.sol`, `ignition/`, `scripts/`, `hardhat.config.ts`, CI → copy → `packages/blockchain/`. Rename the token and fix the stale package name `test402-erc20`.
  - Write a new BullMQ + viem `allocateBatch` job → `services/blockchain-service`.
- **Caveat:** privileged keys can mint without a cap. Document this; make no financial promises (§31).

### nft-assets-server-main (no LICENSE, poor quality)
- **What:** Cloudflare Worker (Hono) that indexes NFT media via Alchemy, caches to R2 and stores metadata in Supabase. Has an x402 paywall stub and an NVIDIA NIM LLM agent. No tests.
- **Reuse (patterns only):**
  - `src/worker/sse.js` → `services/api/src/lib/sse.ts`
  - `src/worker/nvidia.js` → OpenAI-compatible LLM provider with retry and quota classification
  - `src/worker/nftMedia.js` → `packages/blockchain`
  - `ingest.ts` / `db.ts` / `schema.sql` → reference for the S3 ingest pipeline
- **🚨 SECURITY:**
  - `test_nonce.js:4-5` contains a hard-coded Alchemy API key and a **64-hex wallet private key**. The file is committed (`221d39a`) and the GitHub repo is **public**. Treat both as compromised.
  - `api-server.ts:286-411`: `/fund` and `/pay-owners` sign ERC-20 transfers with `env.PRIVATE_KEY` from **unauthenticated** routes.
  - `x402.ts:650` accepts a spoofable "settled" header.
- **Don't reuse:** x402, `/fund`, `/pay-owners`, `payments.js`, MCP server, brands registry, Supabase coupling.

### x-relay-main (no LICENSE, high quality, 77 vitest tests)
- **What:** X posting relay. Per-user OAuth2+PKCE, encrypted tokens, guardrails, idempotency, draft queue with approval links, cron scheduler, audit log.
- **Copy** → `services/api/src/distribution/x/`:
  - `worker/lib/xclient.ts`
  - `crypto.ts` (AES-GCM envelope + key rotation)
  - `guardrails.ts`, `schedule.ts`, `errors.ts`
- **Adapt:**
  - `tokens.ts`, `idempotency.ts`, `dispatch.ts`, `scheduler.ts`, `queue.ts`: D1 → Prisma, CAS lock → Redis, cron → BullMQ repeatable job
  - `schema.sql` → Prisma models (SocialAccount/Post/Queue/AuditLog)
  - `routes/oauth.ts` + `routes/approve.ts` → Express + Zod
- **Check:** `STATUS.md` says a builder JWT was once committed upstream.
- **Don't reuse:** `ops/`, `playbooks/`, `routes/debug.ts`, Cloudflare bindings.

### CreatorOS-main (no LICENSE, hackathon demo)
- **What:** 4-agent creator assistant. React 18 + Vite + Tailwind 3, Vercel functions, state in localStorage.
- **No real auth:** `ProtectedRoute.tsx` does nothing.
- **Fakes:**
  - Hard-coded metrics in `DashboardContext.tsx:204`
  - `predictedPerformanceScore = Date.now() % 7`
  - `connectPlatform` is a `setTimeout` with no OAuth
- **Take only:**
  - Zernio social-proxy contract (`api/zernio/*`, `src/lib/zernio.ts`) → optional aggregator DistributionProvider
  - Repurpose prompt + JSON extractor at `api/minds/repurpose.ts:34-109` → `services/ai-service/prompts`
  - Brand icons in `src/components/Icons.tsx` → `packages/ui/icons`
  - `PlannerPage.tsx` calendar → `apps/admin` content calendar, fed from the API
- **Don't reuse:** `agents/`, `mindsStore`, `DashboardContext`, the growth and analytics agents.

### metarealm-growth-os-main (no LICENSE, strongest source here)
- **What:** founder business OS. Python FastAPI + SQLAlchemy + Alembic backend; Next 15 / React 19 / Tailwind v4 / Radix (shadcn-style) frontend. 14 AI "employee" agents.
- **No auth, users or RBAC.** CORS is `*` on the error handler.
- **Port to TS:**
  - Agent registry, `log_run`, orchestrator (`agents/{registry,runtime,orchestrator}.py`) → `services/ai-service` + BullMQ; `AgentRun` → Prisma `AiJobRun`
  - Prompts-as-`.md` convention (`services/llm.py`, `prompts/*.md`)
  - **Content review queue:** `ContentItem.status`, `api/content.py`, `content_strategist.py`, UI `ContentStudioView`, `ContentDetailSheet`, `AiDraftSheet`, `ContentApprovalWidget` → §27/§56 review workflow
  - News intel: `services/rss.py`, `market_intelligence.py` scoring/dedup, `services/search.py` + `SearchBudget` → Newsroom (§23)
  - Runtime settings (DB overrides env; secrets shown only as set or not set) → admin settings
  - RAG (`services/rag.py`, `embeddings.py`) → reference only; use pgvector
- **Copy:**
  - `frontend/components/ui/*` (shadcn kit) and `components/shared/*` → `packages/ui`
  - `AppShell`, `AppSidebar`, `AppHeader`, `navigation.ts` → `apps/admin` shell. Remove the hard-coded founder name.
  - `PipelineBoard` → sponsor/deal pipeline
- **Don't reuse:** CRM, outreach, email finder, proposal code; `seed_data.py` and `knowledge/` (client data in 34 files); string-date columns.

### ai-video-editor-main ("Timeline Studio", MIT for code only)
- **What:** local-first browser video editor. React 19 + Vite 6, mostly untyped JS, in-browser AI (Whisper, TTS, WebGPU).
- **Quality:** zero tests. `tsconfig` only covers 2 files. Very large files (`Timeline.jsx` 3,910 lines).
- **Model weights are NOT MIT-licensed** (see `MODEL_LICENSES.md`). The face-swap weights are research-only.
- **Copy with attribution → TS packages:**
  - `src/lib/projectRenderPlan.js`: pure ffmpeg `filter_complex` planner → `services/media-worker`
  - `src/lib/smartFrame.js`: 16:9 → 9:16 / 1:1 crop solver → vertical and square clips (§13)
  - `src/lib/subtitles.js`: SRT; `src/lib/exportSettings.js`: bitrate tables → shared
  - `src/lib/timeline.js`, `timelineCutActions.js`, `timelineRipple.js`, `timelineSnap.js` → shared + admin clip-review editor
  - `src/lib/captionLayout.js`, `captionStyles.js`, `CaptionOverlay.jsx` → `packages/player`
  - `src/plugins/generation/{contract,registry,host}.js` → provider-adapter pattern
- **Reference:**
  - `src/lib/asr.js` caption segmentation → TranscriptionProvider
  - `autoEdit.js` scene-change math → AI clipping
  - `media.js:2214-2452` ffmpeg arguments
  - `projectCommandEngine.js` plan → validate → diff → apply, as the model for review
- **Don't reuse:**
  - Browser WebGPU/ONNX runtimes
  - Face swap, LivePortrait, JoyVASA (license and deepfake risk)
  - `App.jsx` and `Timeline.jsx` UI
  - `public/vendor/*`
  - i18n blobs

### nft-video-gen-main ("minds.MONSTER", NO LICENSE: re-implement, don't copy)
- **What:** React 19 + Vite 8 + Cloudflare Worker agent swarm (NVIDIA / OpenRouter / OpenAI / MiniMax), Stripe credits. 30 `node --test` tests.
- **Reference designs:**
  - `worker/sse.js` + `job-events.js` + `job-log.js`: resumable SSE job log → BullMQ progress + SSE endpoint
  - `worker/director-job.js`: step-machine worker
  - `worker/minimax.js` / `nvidia.js` / `openrouter.js`: provider error taxonomy (retryable, quota, content-filtered)
  - `worker/signed-media.js`: HMAC signed media URLs → signed HLS/clip URLs
  - `scripts/encode-hero.sh`: AV1/HEVC/H.264 encode ladder, poster, faststart
  - `scripts/gen-audio.mjs`: sidechain ducking
- **⚠ Security flags:**
  - `scripts/test-mindname-display.mjs:4` has a hard-coded signed session token. Revoke it if still valid.
  - `src/services/wallet.js:6,30` stores a raw private key in localStorage. Never reuse.
  - `wrangler.jsonc` contains a personal email address and production origins.
- **Don't reuse:** the NFT/Minds agents, three.js UI, `wallet.js`, `nfts.json`, `kimi_backup/`.

---

### Reuse summary: what we build from vs. from scratch

| StockTank area | Source | Mode |
|---|---|---|
| `packages/ui` shadcn kit, admin shell | metarealm `frontend/components/{ui,shared,layout}` | copy/adapt* |
| `packages/player` audio | your-podcast `AudioContext`, `ProgressBar`, `MiniPlayer` | adapt* |
| Captions / clip crop / render plan | ai-video-editor `src/lib/*` | copy (MIT) |
| Media job progress (SSE) | nft-video-gen / nft-assets `sse.js` | re-implement |
| AI pipeline / agents | minds-orchestrator `runChain` (MIT) + metarealm registry | adapt |
| LLM provider adapters | nvidia.js / openrouter.js patterns | re-implement |
| Review queue (§27, §56) | metarealm content studio | adapt* |
| Newsroom (§23) | metarealm rss + market_intelligence | port* |
| X distribution | x-relay `lib/*` | copy/adapt* |
| Rewards / web3 (optional) | minds-reward contracts (MIT) | copy |
| **From scratch** | auth + RBAC, Prisma schema, Castopod/AzuraCast adapters, RSS generation, HLS pipeline, Meilisearch, ads, mobile, TV | new |

\* No LICENSE file, but the owner confirmed full permission (2026-09-16), so copying is OK.
