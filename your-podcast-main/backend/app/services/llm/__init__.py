"""LLM provider abstraction — factory for text generation clients."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.services.llm.base import LLMClient
from app.services.llm.gemini_adapter import GeminiClient
from app.services.llm.zhipu_adapter import ZhipuClient

if TYPE_CHECKING:
    from app.config import Settings

__all__ = ["LLMClient", "GeminiClient", "ZhipuClient", "get_llm_client"]

logger = logging.getLogger(__name__)

_TASK_SETTING_MAP = {
    "filter": "llm_provider_filter",
    "keywords": "llm_provider_keywords",
    "title": "llm_provider_title",
}


def get_llm_client(settings: Settings, task: str) -> LLMClient | None:
    """Return an LLMClient for the given task based on settings.

    Returns None if the required API key is missing, allowing callers
    to degrade gracefully.
    """
    attr = _TASK_SETTING_MAP.get(task)
    if not attr:
        raise ValueError(f"Unknown LLM task: {task!r}")

    provider = getattr(settings, attr)

    if provider == "gemini":
        if not settings.gemini_api_key:
            logger.warning("No gemini_api_key for task %s, skipping", task)
            return None
        return GeminiClient(settings.gemini_api_key, model=settings.gemini_model)

    if provider == "zhipu":
        if not settings.zhipu_api_key:
            logger.warning("No zhipu_api_key for task %s, skipping", task)
            return None
        return ZhipuClient(settings.zhipu_api_key, model=settings.zhipu_model)

    raise ValueError(f"Unknown LLM provider: {provider!r} for task {task!r}")
