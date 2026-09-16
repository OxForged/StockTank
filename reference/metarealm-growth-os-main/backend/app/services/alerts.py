"""Proactive alerts, sent to your phone or saved as a daily digest.

Free channels only:
- Telegram, if you set a bot token and chat id in Settings. Instant, on
  your phone, five minute setup.
- Daily digest, always saved, so you can read or email it yourself.

WhatsApp is not here on purpose, it needs a verified Meta business and
paid per message fees, not worth it for you. Telegram does the same job
for free.
"""

import httpx

from app.core.config import settings


def send_telegram(text: str) -> bool:
    """Send one alert to your Telegram, if it is set up. Safe if not."""
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
    chat_id = getattr(settings, "TELEGRAM_CHAT_ID", "") or ""
    if not token or not chat_id:
        return False
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": False},
            timeout=15,
        )
        return r.status_code == 200
    except Exception:
        return False


def notify(text: str) -> dict:
    """Try every channel that is set up. Always safe, never blocks a run."""
    sent = {"telegram": send_telegram(text)}
    return sent
