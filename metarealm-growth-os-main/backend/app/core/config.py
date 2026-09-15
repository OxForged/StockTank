"""Application settings, loaded from environment / .env file."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite by default so `uvicorn app.main:app` just works without Docker.
    # docker/.env points this at the Postgres container instead.
    DATABASE_URL: str = "sqlite:///./dev.db"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Seed the database with starter data on first boot if it is empty.
    AUTO_SEED: bool = True

    # Timestamps shown in briefs and agent runs.
    TIMEZONE: str = "Africa/Casablanca"

    # --- Knowledge base ---
    # Local dev runs from backend/, so folders sit one level up.
    # Docker overrides these to /app/knowledge and /app/prompts (see compose).
    KNOWLEDGE_DIR: str = "../knowledge"
    PROMPTS_DIR: str = "../prompts"
    UPLOADS_DIR: str = "../uploads"

    # --- AI providers ---
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    # "ollama" (free, local) | "anthropic" (paid upgrade) | "stub" (tests only)
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "qwen2.5:7b-instruct"
    EMBED_MODEL: str = "nomic-embed-text"
    ANTHROPIC_API_KEY: str = ""
    # Check docs.claude.com for current model names before switching provider.
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # Comma separated employee names that should use the paid Anthropic brain
    # when a key is set, e.g. "content-strategist,executive-assistant".
    # Everything else stays on free local Ollama.
    PREMIUM_AGENTS: str = ""

    # --- Search ---
    # Free self-hosted search, always tried first at zero cost. Only
    # reachable when you run: docker compose --profile agents up -d
    SEARXNG_URL: str = "http://localhost:8080"

    # Optional paid providers. Leave blank to stay 100 percent free.
    # Paste a key in Settings to switch a capability on.
    #  - Grok (xAI) reads live X/Twitter, where gaming and web3 deals
    #    break first. Billed per search call plus tokens, a few dollars
    #    a month for one morning scan. Get a key at docs.x.ai.
    #  - Perplexity gives cited real-time news from the open web,
    #    including public LinkedIn pages Google has indexed.
    XAI_API_KEY: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    HUNTER_API_KEY: str = ""
    XAI_MODEL: str = "grok-4.3"
    PERPLEXITY_API_KEY: str = ""
    PERPLEXITY_MODEL: str = "sonar"
    TAVILY_API_KEY: str = ""

    # Hard safety cap: an agent can never make more than this many paid
    # search calls in one run, so a bug can never run up your bill.
    MAX_PAID_SEARCHES_PER_RUN: int = 40
settings = Settings()
