"""Pipeline orchestrator — runs the full podcast generation pipeline.

Each step updates the Task record so the frontend can poll progress.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone

from app.config import Settings
from app.db import DatabaseClient
from app.db import queries
from app.schemas import TaskStatus
from app.services import audio, cover, news, podcast, rss, storage, tts
from app.services.llm import get_llm_client
from app.services.llm import prompts as llm_prompts

logger = logging.getLogger(__name__)

DEFAULT_FEEDS = [
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://www.theverge.com/rss/index.xml",
    "https://techcrunch.com/feed/",
]


async def _update_task(
    db: DatabaseClient,
    task_id: str,
    progress: str,
    status: str = TaskStatus.processing,
) -> None:
    await queries.update_task(db, task_id, status=status, progress=progress)


async def run_pipeline(
    *,
    user: dict,
    feed_urls: list[str],
    episode_date: str,
    task_id: str,
    db: DatabaseClient,
    settings: Settings,
    dry_run: bool = False,
    keywords: list[str] | None = None,
) -> dict | None:
    """Execute the full podcast generation pipeline.

    Two modes:
    - Keyword-driven (keywords provided): fetch from keyword-mapped RSS sources,
      use keywords as Gemini filter interests, store input keywords directly.
    - Legacy (no keywords): static feeds + user interests filter +
      post-generation keyword extraction.

    Updates task.progress at each step for frontend polling.
    """
    try:
        return await _run_pipeline_inner(
            user=user,
            feed_urls=feed_urls,
            episode_date=episode_date,
            task_id=task_id,
            db=db,
            settings=settings,
            dry_run=dry_run,
            keywords=keywords,
        )
    except Exception:
        logger.exception("Pipeline failed for task %s", task_id)
        await _update_task(db, task_id, "failed: unexpected error", TaskStatus.failed)
        return None


async def _run_pipeline_inner(
    *,
    user: dict,
    feed_urls: list[str],
    episode_date: str,
    task_id: str,
    db: DatabaseClient,
    settings: Settings,
    dry_run: bool,
    keywords: list[str] | None = None,
) -> dict | None:
    keyword_mode = bool(keywords)

    # Step 1: Fetch RSS
    await _update_task(db, task_id, "fetching_rss")
    if keyword_mode:
        logger.info("Keyword mode: fetching articles for keywords %s", keywords)
        articles = await news.fetch_articles_by_keywords(keywords)
    else:
        logger.info("Legacy mode: fetching articles from %d feeds...", len(feed_urls))
        articles = await rss.fetch_articles(feed_urls)
    logger.info("Fetched %d articles", len(articles))

    if not articles:
        logger.warning("No articles found, aborting")
        await _update_task(db, task_id, "failed: no articles", TaskStatus.failed)
        return None

    # Step 2: Filter articles with LLM
    await _update_task(db, task_id, "filtering_articles")
    filter_client = get_llm_client(settings, "filter")
    logger.info("Filtering articles with %s...", settings.llm_provider_filter)
    filter_interests = keywords if keyword_mode else user["interests"]
    filtered = await llm_prompts.filter_articles(articles, filter_interests, filter_client)
    logger.info("Selected %d articles", len(filtered))

    # Step 3: Generate script via Podcastfy
    await _update_task(db, task_id, "generating_script")
    logger.info("Generating podcast script...")
    script_lines = await podcast.generate_script(filtered, settings.gemini_api_key)
    logger.info("Generated %d script lines", len(script_lines))

    if not script_lines:
        logger.error("Script generation failed, aborting")
        await _update_task(db, task_id, "failed: script generation", TaskStatus.failed)
        return None

    # Step 4: TTS synthesis
    await _update_task(db, task_id, "synthesizing_tts")
    logger.info("Synthesizing %d lines via TTS...", len(script_lines))
    audio_files = await tts.synthesize_lines(script_lines, settings)
    logger.info("TTS complete: %d files", len(audio_files))

    # Step 5: Merge audio
    await _update_task(db, task_id, "merging_audio")
    logger.info("Merging audio files...")
    mp3_path, duration = await audio.merge_audio(audio_files)
    logger.info("Merged -> %s (%ds)", mp3_path, duration)

    # Step 5.5: Resolve keywords
    if keyword_mode:
        logger.info("Using input keywords: %s", keywords)
    else:
        kw_client = get_llm_client(settings, "keywords")
        keywords = await llm_prompts.generate_keywords(script_lines, kw_client)
        logger.info("Extracted %d keywords from transcript", len(keywords))

    # Step 5.6: Generate AI title from transcript
    title_client = get_llm_client(settings, "title")
    ai_title = await llm_prompts.generate_title(script_lines, title_client)
    if ai_title:
        title = ai_title
    else:
        try:
            dt = datetime.strptime(episode_date, "%Y-%m-%d")
            display_date = f"{dt.strftime('%b')} {dt.day}"
        except ValueError:
            display_date = episode_date
        title = f"Your Podcast -- {display_date}"
    logger.info("Episode title: %s", title)

    # Step 6: Generate cover image
    await _update_task(db, task_id, "generating_cover")
    logger.info("Generating cover image...")
    cover_path = await cover.generate_cover(title, keywords, settings)

    if cover_path and not dry_run:
        cover_key = f"covers/{episode_date}/{uuid.uuid4().hex}.png"
        cover_url = await storage.upload_to_r2(cover_path, cover_key, settings, content_type="image/png")
        os.unlink(cover_path)
        logger.info("Cover uploaded -> %s", cover_url)
    elif cover_path and dry_run:
        cover_url = f"file://{cover_path}"
        logger.info("[DRY RUN] Cover saved locally -> %s", cover_path)
    else:
        cover_url = cover.generate_cover_url(title)
        logger.info("Using placeholder cover -> %s", cover_url)

    # Step 7: Upload to R2
    if dry_run:
        audio_url = f"file://{mp3_path}"
        logger.info("[DRY RUN] Skipping R2 upload")
    else:
        await _update_task(db, task_id, "uploading")
        logger.info("Uploading to R2...")
        key = f"episodes/{episode_date}/{uuid.uuid4().hex}.mp3"
        audio_url = await storage.upload_to_r2(mp3_path, key, settings)
        logger.info("Uploaded -> %s", audio_url)

    # Step 8: Save to database
    now = datetime.now(timezone.utc).isoformat()
    episode_id = str(uuid.uuid4())

    episode = {
        "id": episode_id,
        "title": title,
        "keywords": json.dumps(keywords),
        "cover_url": cover_url,
        "audio_url": audio_url,
        "duration": duration,
        "is_public": True,
        "creator_id": user["id"],
        "published_at": now,
    }

    await _update_task(db, task_id, "saving")
    await queries.save_pipeline_result(
        db,
        task_id=task_id,
        episode=episode,
        sources=filtered,
        transcript_lines=script_lines,
    )

    logger.info("Episode saved: %s -- %s", episode_id, title)
    return episode
