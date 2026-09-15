"""Keyword-driven article fetching from curated RSS sources.

config/rss_sources.json mirrors the exact category structure from
awesome-rss-feeds (https://github.com/plenaryapp/awesome-rss-feeds).

Keywords are matched to categories via case-insensitive lookup.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

from app.services.rss import Article, fetch_articles

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "rss_sources.json"


@lru_cache(maxsize=1)
def _load_sources() -> dict[str, list[dict]]:
    with open(_CONFIG_PATH) as f:
        data = json.load(f)
    logger.info("Loaded RSS sources config: %d categories", len(data))
    return data


def get_available_categories() -> list[str]:
    """Return the list of categories from the config."""
    return list(_load_sources().keys())


def _resolve_category(keyword: str, sources: dict[str, list[dict]]) -> list[dict]:
    """Match a keyword to a category (case-insensitive)."""
    # Exact match first
    if keyword in sources:
        return sources[keyword]
    # Case-insensitive match
    lower = keyword.lower()
    for cat, feeds in sources.items():
        if cat.lower() == lower:
            return feeds
    return []


_MAX_FEEDS_PER_CATEGORY = 5


async def fetch_articles_by_keywords(keywords: list[str]) -> list[Article]:
    """Resolve keywords to RSS feed URLs and fetch articles.

    Each keyword is matched to a category in rss_sources.json.
    At most 5 feeds per category are used to keep fetch time reasonable.
    Feed URLs are deduplicated across keywords before fetching.
    Article filtering/selection is left to the LLM provider in the pipeline.
    """
    sources = _load_sources()

    feed_urls: list[str] = []
    seen_urls: set[str] = set()

    for keyword in keywords:
        feeds = _resolve_category(keyword, sources)
        if not feeds:
            logger.warning("No RSS category matched for keyword: %s", keyword)
            continue
        for feed in feeds[:_MAX_FEEDS_PER_CATEGORY]:
            url = feed["url"]
            if url not in seen_urls:
                seen_urls.add(url)
                feed_urls.append(url)

    if not feed_urls:
        logger.warning("No feed URLs resolved for keywords: %s", keywords)
        return []

    logger.info(
        "Resolved %d keywords to %d unique feeds",
        len(keywords),
        len(feed_urls),
    )
    return await fetch_articles(feed_urls)
