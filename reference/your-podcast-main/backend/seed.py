#!/usr/bin/env python
"""Seed script — insert sample episodes for frontend development.

Usage:
    python seed.py              # insert 3 sample episodes
    python seed.py --clear      # delete all seed data first, then re-insert
"""

import argparse
import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

from app.db import DatabaseClient, create_db_client
from app.db import queries

SYSTEM_EMAIL = "seed@your-podcast.local"

SAMPLE_EPISODES = [
    {
        "title": "GPT-5 Launches, iOS 20 Preview & Nvidia Hits $4T",
        "keywords": ["GPT-5", "WWDC 2026", "Nvidia"],
        "duration": 480,
        "sources": [
            {"title": "OpenAI launches GPT-5 with massive multimodal reasoning improvements", "url": "https://techcrunch.com/example-1", "source": "TechCrunch"},
            {"title": "Apple WWDC 2026 preview: iOS 20 to introduce a new AI assistant", "url": "https://www.theverge.com/example-1", "source": "The Verge"},
            {"title": "Nvidia hits $4 trillion market cap as AI demand surges", "url": "https://arstechnica.com/example-1", "source": "Ars Technica"},
        ],
        "transcript": [
            {"speaker": "Alex", "text": "Hey everyone! Welcome to today's Your Podcast, I'm Alex."},
            {"speaker": "Jordan", "text": "And I'm Jordan! We've got some big news to cover today."},
            {"speaker": "Alex", "text": "That's right. First up, OpenAI has officially launched GPT-5 with a huge leap in multimodal reasoning."},
            {"speaker": "Jordan", "text": "Yeah, apparently its math and code generation performance is approaching expert level now."},
            {"speaker": "Alex", "text": "Our second topic is Apple's WWDC 2026. Rumor has it iOS 20 will introduce an entirely new AI assistant."},
            {"speaker": "Jordan", "text": "Finally! Apple has been pretty conservative on AI. Think they'll surprise us this time?"},
            {"speaker": "Alex", "text": "And lastly, let's talk about Nvidia hitting a four trillion dollar market cap."},
            {"speaker": "Jordan", "text": "The AI chip demand just keeps growing. It's wild how fast things are moving."},
            {"speaker": "Alex", "text": "Alright, that's all for today's show. Thanks for listening!"},
            {"speaker": "Jordan", "text": "See you tomorrow! Bye!"},
        ],
    },
    {
        "title": "Rust 2026 Edition Ships & WebGPU Goes Cross-Browser",
        "keywords": ["Rust", "WebGPU", "Llama 4"],
        "duration": 420,
        "sources": [
            {"title": "Rust 2026 Edition officially released with stable async traits", "url": "https://arstechnica.com/example-2", "source": "Ars Technica"},
            {"title": "WebGPU finally lands in Safari, completing cross-browser support", "url": "https://www.theverge.com/example-2", "source": "The Verge"},
        ],
        "transcript": [
            {"speaker": "Alex", "text": "Welcome to Your Podcast! Today we're covering a couple of topics developers will love."},
            {"speaker": "Jordan", "text": "First up, the Rust 2026 Edition is finally here!"},
            {"speaker": "Alex", "text": "The biggest highlight is that async traits are officially stable now. The community has been waiting years for this."},
            {"speaker": "Jordan", "text": "The other big news is WebGPU landing in Safari."},
            {"speaker": "Alex", "text": "This means we now have full cross-browser support for WebGPU, which is huge for web-based 3D and games."},
            {"speaker": "Jordan", "text": "That's a wrap for today. See you next time!"},
        ],
    },
    {
        "title": "Copilot X Gets Smarter, Tesla FSD Hits Europe & Project Astra",
        "keywords": ["Copilot X", "Tesla FSD", "Project Astra"],
        "duration": 360,
        "sources": [
            {"title": "GitHub Copilot X major update: full repository context understanding", "url": "https://techcrunch.com/example-2", "source": "TechCrunch"},
            {"title": "Tesla FSD V13 approved for testing in select European cities", "url": "https://arstechnica.com/example-3", "source": "Ars Technica"},
            {"title": "Google launches Project Astra, a real-time multimodal AI assistant", "url": "https://www.theverge.com/example-3", "source": "The Verge"},
        ],
        "transcript": [
            {"speaker": "Alex", "text": "Hey everyone, welcome to Your Podcast!"},
            {"speaker": "Jordan", "text": "Today's headline is a major update to GitHub Copilot X."},
            {"speaker": "Alex", "text": "That's right. Copilot can now understand the full repository context, not just single-file completions."},
            {"speaker": "Jordan", "text": "We've also got big news — Tesla's FSD V13 has been approved for testing in Europe!"},
            {"speaker": "Alex", "text": "It's only a few cities for now, but it marks a significant step for autonomous driving expansion."},
            {"speaker": "Jordan", "text": "Thanks for listening, see you tomorrow!"},
        ],
    },
]


async def seed(db: DatabaseClient) -> None:
    user = await queries.get_user_by_email(db, SYSTEM_EMAIL)
    if not user:
        user = await queries.upsert_user(
            db,
            email=SYSTEM_EMAIL,
            name="Yifan",
            avatar_url="",
            provider="system",
            provider_id="seed",
        )
        await queries.update_user_interests(
            db, user["id"], ["AI", "technology", "programming", "startups"]
        )

    now = datetime.now(timezone.utc)

    for i, ep_data in enumerate(SAMPLE_EPISODES):
        episode_id = str(uuid.uuid4())
        published_at = (now - timedelta(days=i)).isoformat()

        episode = {
            "id": episode_id,
            "title": ep_data["title"],
            "keywords": json.dumps(ep_data["keywords"]),
            "cover_url": f"https://placehold.co/800x800/6366f1/a855f7.png?text=EP{i + 1}",
            "audio_url": f"https://cdn.example.com/episodes/sample-{i + 1}.mp3",
            "duration": ep_data["duration"],
            "is_public": True,
            "creator_id": user["id"],
            "published_at": published_at,
        }

        # Build batch statements
        stmts: list[dict] = []
        stmts.append({
            "sql": """INSERT INTO episode (id, title, keywords, cover_url, audio_url, duration, is_public, creator_id, published_at)
                      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            "params": [
                episode["id"], episode["title"], episode["keywords"],
                episode["cover_url"], episode["audio_url"], episode["duration"],
                episode["creator_id"], episode["published_at"],
            ],
        })

        for src in ep_data["sources"]:
            stmts.append({
                "sql": "INSERT INTO source (id, episode_id, title, url, source) VALUES (?, ?, ?, ?, ?)",
                "params": [str(uuid.uuid4()), episode_id, src["title"], src["url"], src["source"]],
            })

        for j, line in enumerate(ep_data["transcript"]):
            stmts.append({
                "sql": "INSERT INTO transcript_line (id, episode_id, line_order, speaker, text) VALUES (?, ?, ?, ?, ?)",
                "params": [str(uuid.uuid4()), episode_id, j, line["speaker"], line["text"]],
            })

        await db.batch(stmts)

    print(f"Seeded {len(SAMPLE_EPISODES)} episodes for user {user['name']} ({user['email']})")


async def clear(db: DatabaseClient) -> None:
    user = await queries.get_user_by_email(db, SYSTEM_EMAIL)
    if not user:
        print("No seed user found, nothing to clear")
        return

    # Delete in order respecting foreign keys
    stmts = [
        {"sql": "DELETE FROM transcript_line WHERE episode_id IN (SELECT id FROM episode WHERE creator_id = ?)", "params": [user["id"]]},
        {"sql": "DELETE FROM source WHERE episode_id IN (SELECT id FROM episode WHERE creator_id = ?)", "params": [user["id"]]},
        {"sql": "DELETE FROM task WHERE user_id = ?", "params": [user["id"]]},
        {"sql": "DELETE FROM episode WHERE creator_id = ?", "params": [user["id"]]},
        {"sql": "DELETE FROM user WHERE id = ?", "params": [user["id"]]},
    ]
    await db.batch(stmts)
    print("Cleared all seed data")


async def async_main() -> None:
    parser = argparse.ArgumentParser(description="Seed sample podcast data")
    parser.add_argument("--clear", action="store_true", help="Clear seed data before inserting")
    args = parser.parse_args()

    db = create_db_client()

    try:
        if args.clear:
            await clear(db)
        await seed(db)
    finally:
        await db.aclose()


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
