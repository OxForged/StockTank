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

### In progress: "Hybrid build + marketing + selling ad spots"
Remaining work, built directly with no subagents:
1. API: public content (`/api/v1/home`, shows, projects, companies, search), feature flags, media kit, ad serving with signed impression and click tracking, advertising inquiries, newsletter double opt-in with an email provider adapter; admin endpoints for advertisers, placements/rate card, campaigns, creatives, review queue, reports, leads, subscribers, flags. Plus tests and OpenAPI.
2. Seeds: ad placement inventory (unpriced), house advertiser and house campaigns, DEMO content (shows, episodes, clips, articles, projects, companies, rundown), all flagged `isDemo`.
3. api-client methods for all of the above.
4. apps/web: rebuild to match the Hybrid artboard (rail nav, header with search/clock/theme, MARKETS tape, hero + live desk, latest tabs, watchlist, rundown, lineup, mini player), plus ad slots with "Sponsored" disclosure, an `/advertise` media kit with inquiry form, newsletter signup, and UTM capture.
5. apps/admin: Advertising (overview, advertisers, campaigns, creatives, review queue, rate card, reports), Leads, Newsletter, Feature flags.
6. Local-only staff sign-in shortcut (the owner asked for no-auth staff login on localhost).
7. `docs/marketing/` go-to-market marketing and ad-sales playbook.

### Run locally
```bash
pnpm install
bash scripts/dev-setup.sh        # infra, migrations, seeds (dev + test DB)
pnpm dev                         # API :4000, web :5190, admin :5181
```
Admin: `admin@stocktank.local`, password is `SEED_ADMIN_PASSWORD` in `.env` (gitignored).
