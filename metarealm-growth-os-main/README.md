# MetaRealm OS

The internal AI business operating system for **MetaRealm** (gaming marketing agency) and **Lunaris Esports**. Not a CRM, not an admin panel — the tool the founder opens every morning to see opportunities, companies to contact, content waiting for approval, gaming news, and the day's priorities.

## Run it

Everything here is free and open source. You need Node.js 18.18+, and either Docker Desktop (recommended) or Python 3.12.

**1. Backend + database (Docker path):**

```bash
copy backend\.env.example backend\.env     # macOS/Linux: cp backend/.env.example backend/.env
docker compose -f docker/docker-compose.yml up -d --build
```

That starts Postgres and the API on http://localhost:8000 — it runs migrations and seeds starter data automatically. API docs live at http://localhost:8000/docs.

**Quick path without Docker:** open a terminal in `backend/` and run `pip install -r requirements.txt` then `uvicorn app.main:app` — it falls back to a local SQLite file (`dev.db`). Same API, zero containers.

**2. Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Or start everything at once with `scripts/start-dev.ps1`.

## Structure

```
metarealm-os/
├── frontend/                 # Next.js 15 — the operating surface
│   ├── app/                  # Routes only — pages fetch and compose
│   ├── components/           # By business domain: dashboard, opportunities,
│   │                         #   companies, contacts, meetings, content,
│   │                         #   layout, navigation, shared, ui
│   ├── lib/api/              # server.ts (page fetchers) + client.ts (mutations)
│   └── types/                # Domain models — mirrors backend/app/schemas
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── models/           # SQLAlchemy tables
│   │   ├── schemas/          # Pydantic (camelCase on the wire = frontend/types)
│   │   ├── api/              # Routers: companies, contacts, opportunities,
│   │   │                     #   touches, meetings, content, news, dashboard
│   │   ├── seed_data.py      # Starter dataset
│   │   └── seed.py           # python -m app.seed (also auto-runs when empty)
│   └── alembic/              # Migrations (run automatically in Docker)
├── docker/docker-compose.yml # db + api; searxng + n8n behind --profile agents
├── scripts/start-dev.ps1
├── knowledge/                # RAG corpus (ships with the Lunaris deck + stats bank)
├── prompts/                  # Editable AI prompts (knowledge-answer.md live now)
└── uploads/                  # Generated files (proposals, from M8)
```

## Free-software stance

Running today: Next.js 15, React 19, Tailwind v4, Radix, FastAPI, SQLAlchemy, Alembic, PostgreSQL + pgvector, Docker, Ollama, LangGraph, SearXNG, feedparser, self-hosted n8n. Paid APIs (Claude) remain an optional per-agent upgrade via PREMIUM_AGENTS in backend/.env.
