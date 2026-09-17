# StockTank — Claude Code notes

- Scope and spec: `README.md` (master build prompt). Go-to-market plan, component audits, and reuse map: `docs/GTM_PLAN.md`.
- Brand direction: `stocktankexample.png`. Dark navy base, emerald accent, "STOCK" in white and "TANK" in green.

## Design direction (owner, 2026-09-17)
- **Focus: stocks and meme stocks.** The product, content taxonomy and visuals should read as a markets/meme-stock media network, not a generic crypto site.
- **Fully animated and interactive UI across web and admin:** charts, graphs, sparklines, heat maps, animated counters and transitions, hover/scrub interactions, live-updating tickers. Static tables alone are not enough anywhere a visual fits.
- Charts show real market data from a MarketDataProvider adapter when configured; until then they show clearly labeled DEMO data. Never present invented prices, volumes or sentiment as real.
- Motion must respect `prefers-reduced-motion`, stay keyboard accessible, and keep charts readable (accessible data tables or summaries behind visuals).
- Market commentary stays informational only; no buy/sell signals or price targets.
- Component folders (now under `reference/`) are building blocks. **The owner has full permission to reuse all of them**, including folders without a LICENSE file. `ai-video-editor-main` model weights keep their own licenses (see its `MODEL_LICENSES.md`).

## Security: must do before production
- **Rotate leaked credentials before any production deploy.** `nft-assets-server-main/test_nonce.js` (Alchemy API key + a wallet private key) was committed to the public GitHub repo. It was purged from history on 2026-09-16, but it was already exposed. The owner will rotate both keys and must not reuse that wallet. Also revoke the session token that was in `nft-video-gen-main/scripts/test-mindname-display.mjs`.
- Never copy these from `reference/`: `nft-assets-server-main` `/fund`, `/pay-owners`, `x402.ts`, `payments.js`; `nft-video-gen-main/src/services/wallet.js`; face-swap/LivePortrait models.
- Never commit secrets. Use `.env` (gitignored) and keep `.env.example` in sync.

## Media pipeline
- Uploads go browser → presigned PUT → `POST /admin/media/assets/:id/complete` (size verified) → BullMQ `stocktank-media` → `services/media-worker` (FFmpeg).
- Object keys: `originals/*` private, `renditions/*` public (CDN). Never make originals public.
- An episode switches to new media only when processing succeeds (`target_episode_id`). Clips are public only when published and always keep source timestamps.
- Worker tests use the test DB and real FFmpeg (`ffmpeg-static` in dev; distro ffmpeg in the Docker image). They run after API tests (turbo.json) because both reset shared tables.

## Podcasts
- StockTank owns the feed: `/podcasts/<slug>/feed.xml` (only published shows with the feed enabled; items need processed audio). DEMO shows get `itunes:block`.
- Castopod (optional) is reached only through `packages/podcast` REST v1. It cannot create/update podcasts or update episodes, so each episode syncs once (`castopod_episode_id`).

## Live radio
- AzuraCast only through `packages/radio`. Never send listeners to AzuraCast pages or expose its shortcodes/ids publicly; never read individual listener records (IPs).
- Now playing is cached per station (`NowPlayingService`); the site must keep working when AzuraCast is down.

## Analytics
- First-party only (`analytics_events`). Never store IPs, raw cookies or user ids; honour GPC/DNT on client and server. Never report unmeasured metrics as zero (use `notTracked`).
- Podcast feed enclosures go through `/podcasts/dl/<episodeId>.mp3` (counted, then 302 to the CDN).

## Conventions
- pnpm workspaces + Turborepo. Workspace globs: `apps/*`, `services/*`, `packages/*` (never `reference/`).
- TypeScript strict everywhere. Zod for all API input/output. API is versioned under `/api/v1`.
- Financial content is informational only: never investment advice. Seed data is labeled DEMO.
- Before calling a milestone done: lint, typecheck, test, build, and the docker compose stack must all pass.
