import asyncio
import logging
from datetime import datetime, timezone
from typing import TypedDict

import feedparser

logger = logging.getLogger(__name__)


class Article(TypedDict):
    title: str
    url: str
    summary: str
    source: str
    published: str


async def fetch_articles(feed_urls: list[str]) -> list[Article]:
    """Fetch and deduplicate articles from multiple RSS feeds."""
    tasks = [asyncio.to_thread(_parse_feed, url) for url in feed_urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    seen_urls: set[str] = set()
    articles: list[Article] = []

    for result in results:
        if isinstance(result, Exception):
            logger.warning("Feed fetch failed: %s", result)
            continue
        for article in result:
            if article["url"] not in seen_urls:
                seen_urls.add(article["url"])
                articles.append(article)

    return articles


def _parse_feed(url: str) -> list[Article]:
    """Parse a single RSS feed (sync, run via to_thread)."""
    feed = feedparser.parse(url)
    if feed.bozo and not feed.entries:
        raise RuntimeError(f"Failed to parse feed: {url}")

    articles: list[Article] = []
    for entry in feed.entries:
        published = ""
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()

        articles.append(
            Article(
                title=entry.get("title", ""),
                url=entry.get("link", ""),
                summary=entry.get("summary", ""),
                source=feed.feed.get("title", url),
                published=published,
            )
        )
    return articles
