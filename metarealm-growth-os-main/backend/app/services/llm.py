"""LLM provider abstraction — one env var switches every agent.

Providers:
- ollama     free, local (default)
- anthropic  paid upgrade, per-agent quality when you want it
- stub       returns a fixed marker string; exists so the full agent
             pipeline can be tested on machines without any model

Every path returns None on failure so features degrade gracefully.
"""

from pathlib import Path

import httpx

from app.core.config import settings

STUB_RESPONSE = "STUB RESPONSE — set LLM_PROVIDER=ollama for real output."


def generate(
    prompt: str, timeout: float = 120.0, provider: str | None = None
) -> str | None:
    active = provider or settings.LLM_PROVIDER
    if active == "stub":
        return STUB_RESPONSE

    if active == "grok" and settings.XAI_API_KEY:
        headers = {
            "Authorization": f"Bearer {settings.XAI_API_KEY}",
            "Content-Type": "application/json",
        }
        # xAI's current endpoint is /v1/responses. The old chat/completions
        # is legacy, so we try the new one first and fall back if needed.
        try:
            response = httpx.post(
                "https://api.x.ai/v1/responses",
                headers=headers,
                json={
                    "model": settings.XAI_MODEL,
                    "input": [{"role": "user", "content": prompt}],
                },
                timeout=timeout,
            )
            response.raise_for_status()
            data = response.json()
            text = ""
            for item in data.get("output", []) or []:
                if item.get("type") == "message":
                    for part in item.get("content", []) or []:
                        if part.get("type") == "output_text":
                            text += part.get("text", "")
            if not text and isinstance(data.get("output_text"), str):
                text = data["output_text"]
            if text.strip():
                return text.strip()
        except Exception:
            pass
        try:
            response = httpx.post(
                "https://api.x.ai/v1/chat/completions",
                headers=headers,
                json={
                    "model": settings.XAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip() or None
        except Exception:
            return None

    if active == "anthropic" and settings.ANTHROPIC_API_KEY:
        try:
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=timeout,
            )
            response.raise_for_status()
            blocks = response.json().get("content", [])
            text = "".join(
                block.get("text", "")
                for block in blocks
                if block.get("type") == "text"
            ).strip()
            return text or None
        except Exception:
            return None

    if active == "ollama":
        try:
            response = httpx.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=timeout,
            )
            response.raise_for_status()
            text = (response.json().get("response") or "").strip()
            return text or None
        except Exception:
            return None

    return None


def render_prompt(template: str, **values: str) -> str:
    """Fill {placeholders} by plain replacement.

    We do NOT use Python str.format here on purpose: prompt files are
    edited by hand and often contain JSON examples with braces, which
    would crash format(). Plain replace can never break.
    """
    for key, value in values.items():
        template = template.replace("{" + key + "}", str(value))
    return template


def load_prompt(name: str, fallback: str) -> str:
    """Load a system prompt from the prompts/ folder, editable without code."""
    path = Path(settings.PROMPTS_DIR) / f"{name}.md"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return fallback
