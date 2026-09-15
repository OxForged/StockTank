from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Cloudflare D1
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    d1_database_id: str = ""

    # Auth - Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Session
    session_secret: str = ""
    frontend_url: str = "http://localhost:3000"

    # Google Gemini
    gemini_api_key: str = ""

    # ZhiPu AI (open.bigmodel.cn)
    zhipu_api_key: str = ""

    # LLM provider per task: "zhipu" or "gemini" (default: zhipu)
    llm_provider_filter: str = "zhipu"
    llm_provider_keywords: str = "zhipu"
    llm_provider_title: str = "zhipu"

    # LLM model names (configurable per provider)
    zhipu_model: str = "glm-5"
    gemini_model: str = "gemini-2.5-flash"

    # Google Vertex AI (for image generation)
    vertex_project_id: str = ""
    vertex_location: str = "us-central1"

    # TTS provider: "google" or "inworld"
    tts_provider: str = "inworld"

    # Google TTS (via Gemini)
    google_tts_model: str = "gemini-2.5-flash-preview-tts"
    google_tts_voice_male: str = "Puck"
    google_tts_voice_female: str = "Aoede"

    # Inworld TTS (direct API — https://inworld.ai)
    inworld_api_key: str = ""
    inworld_tts_model: str = "inworld-tts-1.5-max"
    inworld_tts_voice_male: str = "Theodore"
    inworld_tts_voice_female: str = "Kayla"

    # Environment: "development" or "production"
    environment: str = "development"

    # Database backend: "d1" (Cloudflare D1) or "sqlite" (local file)
    # Defaults to "sqlite" in development, "d1" in production
    database_backend: str = ""

    # Dev mode — saves MP3 to current directory instead of temp
    dev_mode: bool = False

    # RSS Feeds (comma-separated URLs)
    rss_feeds: str = ""

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_url: str = ""

    @property
    def is_dev(self) -> bool:
        return self.environment == "development"

    @model_validator(mode="after")
    def _default_database_backend(self) -> "Settings":
        if not self.database_backend:
            self.database_backend = "sqlite" if self.is_dev else "d1"
        return self

    @model_validator(mode="after")
    def _validate_session_secret(self) -> "Settings":
        if not self.is_dev and not self.session_secret:
            raise ValueError(
                "SESSION_SECRET must be set in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
