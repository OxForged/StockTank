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
| (this) | `docs/marketing/GO_TO_MARKET_AND_AD_SALES.md` playbook |

### Next
- Owner decisions: prices and packages, legal review of drafts, production email provider, hosting/domain
- Milestone 2 admin CMS (shows, episodes, projects, companies editing), Meilisearch, follows API
- Milestone 3 media pipeline (makes the mini player and pre-roll inventory real)

### Run locally
```bash
pnpm install
bash scripts/dev-setup.sh        # infra, migrations, seeds (dev + test DB)
pnpm dev                         # API :4000, web :5190, admin :5181
pnpm db:seed:demo                # optional: DEMO shows, projects, companies, rundown
```
Admin: `admin@stocktank.local`, password is `SEED_ADMIN_PASSWORD` in `.env` (gitignored).
