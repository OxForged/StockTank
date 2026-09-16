"""Read settings that can be overridden at runtime from the database.

Order: database value first (set from the Settings page), then the
.env / config default. Sensitive keys are never sent back to the
browser in full, only whether they are set.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Setting

# Which settings the UI may edit, and whether each is a secret.
EDITABLE = {
    "XAI_API_KEY": {"secret": True},
    "PERPLEXITY_API_KEY": {"secret": True},
    "TAVILY_API_KEY": {"secret": True},
    "ANTHROPIC_API_KEY": {"secret": True},
    "PREMIUM_AGENTS": {"secret": False},
    "LLM_PROVIDER": {"secret": False},
    # Your daily targets. The team tries to hit these each morning.
    "NEWS_MOROCCO": {"secret": False, "default": "5"},
    "NEWS_WEB3": {"secret": False, "default": "7"},
    "NEWS_MENA": {"secret": False, "default": "8"},
    "NEWS_DRAMA": {"secret": False, "default": "3"},
    # Content posts per platform, per topic. You control every one.
    # X posts by topic:
    "X_COMPANY": {"secret": False, "default": "2"},
    "X_MOROCCO": {"secret": False, "default": "2"},
    "X_MENA": {"secret": False, "default": "2"},
    "X_WEB3": {"secret": False, "default": "2"},
    "X_DRAMA": {"secret": False, "default": "2"},
    # LinkedIn posts by topic:
    "LI_COMPANY": {"secret": False, "default": "2"},
    "LI_MOROCCO": {"secret": False, "default": "2"},
    "LI_MENA": {"secret": False, "default": "2"},
    "LI_WEB3": {"secret": False, "default": "2"},
    "LI_DRAMA": {"secret": False, "default": "2"},
    # How many days before a warm deal counts as stale for follow up.
    "FOLLOWUP_DAYS": {"secret": False, "default": "7"},
    # Telegram alerts to your phone, free. Bot token from BotFather.
    "TELEGRAM_BOT_TOKEN": {"secret": True},
    "TELEGRAM_CHAT_ID": {"secret": False},
    "HUNTER_API_KEY": {"secret": True},
    # Hunter free tier protection (~50 credits/month)
    "HUNTER_MONTHLY_CREDITS": {"secret": False, "default": "50"},
    "HUNTER_DAILY_CREDITS": {"secret": False, "default": "2"},
    "HUNTER_EMAILS_PER_COMPANY": {"secret": False, "default": "10"},
    "HUNTER_COMPANIES_PER_DAY": {"secret": False, "default": "2"},
    # Things you teach the OS (tone, ICP, do-not-contact, packaging)
    "BD_PLAYBOOK": {"secret": False, "default": ""},
}


def get_int(db, key: str, fallback: int) -> int:
    """Read a numeric target set in Settings, or the fallback."""
    from app.models import Setting

    row = db.get(Setting, key)
    if row and str(row.value).strip().isdigit():
        return int(row.value)
    meta = EDITABLE.get(key, {})
    default = meta.get("default")
    if default and str(default).isdigit():
        return int(default)
    return fallback


def apply_overrides(db: Session) -> None:
    """Push database settings onto the live config object once at startup
    and after any change, so services read the latest values."""
    for row in db.scalars(select(Setting)).all():
        if row.key in EDITABLE and hasattr(settings, row.key):
            setattr(settings, row.key, row.value)


def get_public_settings(db: Session) -> dict:
    """What the Settings page shows. Secrets appear only as set or not set."""
    stored = {row.key: row.value for row in db.scalars(select(Setting)).all()}
    result = {}
    for key, meta in EDITABLE.items():
        if meta["secret"]:
            current = stored.get(key, getattr(settings, key, ""))
            result[key] = {"set": bool(current), "secret": True}
        else:
            current = stored.get(key, meta.get("default", getattr(settings, key, "")))
            result[key] = {"value": current, "secret": False}
    return result


def save_setting(db: Session, key: str, value: str) -> None:
    if key not in EDITABLE:
        raise ValueError("Not an editable setting")
    row = db.get(Setting, key)
    if row is None:
        db.add(Setting(key=key, value=value))
    else:
        row.value = value
    db.commit()
    apply_overrides(db)
