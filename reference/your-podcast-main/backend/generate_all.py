#!/usr/bin/env python
"""Generate daily podcasts for all users with daily_generation enabled.

Designed to run as a Railway cron service. For each eligible user:
- Uses their interests as keywords (falls back to defaults)
- Randomly picks two Inworld voices
- Skips users with an active task
"""

import asyncio
import logging
import random
from datetime import datetime, timezone

from app.config import get_settings
from app.db import create_db_client, queries
from app.routers.generate import _apply_voice_overrides
from app.services.pipeline import DEFAULT_FEEDS, run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("generate_all")

# Available Inworld voices — verify against your Inworld plan
INWORLD_VOICES_MALE = ["Theodore", "Simon", "Alex", "Shaun", "Elliot"]
INWORLD_VOICES_FEMALE = ["Kayla", "Lauren", "Olivia", "Jessica"]

DEFAULT_INTERESTS = ["technology", "internet", "AI", "programming"]


async def async_main() -> None:
    settings = get_settings()
    db = create_db_client(settings)
    episode_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    users = await queries.list_daily_generation_users(db)
    logger.info("Found %d users with daily generation enabled", len(users))

    succeeded, failed, skipped = 0, 0, 0

    for user in users:
        interests = user["interests"] or DEFAULT_INTERESTS
        user_label = f"{user['name']} ({user['id'][:8]})"

        # Skip if user already has an active task
        active = await queries.get_active_task(db, user["id"])
        if active:
            logger.warning("User %s has active task %s, skipping", user_label, active["id"])
            skipped += 1
            continue

        # Random voice pair
        voice_male = random.choice(INWORLD_VOICES_MALE)
        voice_female = random.choice(INWORLD_VOICES_FEMALE)
        user_settings = _apply_voice_overrides(settings, voice_male, voice_female)

        logger.info(
            "Generating for %s | interests=%s | voices=%s/%s",
            user_label, interests, voice_male, voice_female,
        )

        try:
            task = await queries.create_task(
                db, user_id=user["id"], status="pending", progress="starting",
            )
            episode = await run_pipeline(
                user={**user, "interests": interests},
                feed_urls=DEFAULT_FEEDS,
                episode_date=episode_date,
                task_id=task["id"],
                db=db,
                settings=user_settings,
                keywords=interests,
            )
            if episode:
                logger.info("Done for %s: %s", user_label, episode["title"])
                succeeded += 1
            else:
                logger.warning("Pipeline returned no episode for %s", user_label)
                failed += 1
        except Exception:
            logger.exception("Failed for %s", user_label)
            failed += 1

    await db.aclose()
    logger.info(
        "Batch complete: %d succeeded, %d failed, %d skipped (of %d total)",
        succeeded, failed, skipped, len(users),
    )


if __name__ == "__main__":
    asyncio.run(async_main())
