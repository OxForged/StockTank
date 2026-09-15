import asyncio
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict

from app.services.rss import Article

logger = logging.getLogger(__name__)

_SPEAKER_MAP = {"Person1": "Alex", "Person2": "Jordan"}
_TAG_PATTERN = re.compile(r"<(Person[12])>(.*?)</\1>", re.DOTALL)
# Strip LLM scratchpad/thinking blocks that some models emit before the dialogue
_SCRATCHPAD_PATTERN = re.compile(
    r"^\(scratchpad\).*?(?=<Person[12]>)|"
    r"```scratchpad\n.*?```\n?",
    re.DOTALL,
)


class ScriptLine(TypedDict):
    speaker: str  # "Alex" or "Jordan"
    text: str


_CONVERSATION_CONFIG = {
    "word_count": 3000,
    "conversation_style": ["engaging", "fast-paced", "enthusiastic"],
    "roles_person1": "main summarizer",
    "roles_person2": "questioner/clarifier",
    "dialogue_structure": [
        "Introduction",
        "Main Content Summary",
        "Key Takeaways",
        "Conclusion",
    ],
    "podcast_name": "Your Podcast",
    "podcast_tagline": "Your daily podcast",
    "output_language": "English",
    "engagement_techniques": [
        "rhetorical questions",
        "anecdotes",
        "analogies",
        "humor",
    ],
    "creativity": 0.7,
}


async def generate_script(articles: list[Article], api_key: str) -> list[ScriptLine]:
    """Generate a two-host English podcast dialogue script via Podcastfy.

    Passes article summaries as raw text to Podcastfy (avoids Playwright
    scraping), then parses the <Person1>/<Person2> tags into ScriptLines
    with Alex/Jordan speaker names.
    """
    if not articles:
        return []

    text = _build_article_text(articles)

    transcript_path = await asyncio.to_thread(
        _generate_transcript, text, api_key
    )
    if not transcript_path:
        return []

    with open(transcript_path, encoding="utf-8") as f:
        transcript_text = f.read()

    return _parse_transcript(transcript_text)


def _build_article_text(articles: list[Article]) -> str:
    """Format articles into a single text block for Podcastfy."""
    parts = []
    for i, a in enumerate(articles, 1):
        parts.append(f"Article {i}: {a['title']}")
        parts.append(f"Source: {a.get('source', 'Unknown')}")
        if a.get("summary"):
            parts.append(f"Summary: {a['summary']}")
        parts.append("")
    return "\n".join(parts)


def _generate_transcript(text: str, api_key: str) -> str | None:
    """Call Podcastfy to generate a transcript file (sync, run via to_thread)."""
    try:
        import os

        from podcastfy.client import generate_podcast

        # Use a per-call env copy to avoid mutating the global os.environ
        # (race condition when concurrent threads write different keys).
        old_key = os.environ.get("GEMINI_API_KEY")
        os.environ["GEMINI_API_KEY"] = api_key
        try:
            result = generate_podcast(
                text=text,
                transcript_only=True,
                conversation_config=_CONVERSATION_CONFIG,
                llm_model_name="gemini-2.5-flash-lite",
            )
        finally:
            if old_key is None:
                os.environ.pop("GEMINI_API_KEY", None)
            else:
                os.environ["GEMINI_API_KEY"] = old_key
        if result:
            ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            original_stem = Path(result).stem  # e.g. "transcript_abc123"
            original_hash = original_stem.split("_", 1)[-1]
            new_path = Path(result).parent / f"transcript_{ts}_{original_hash}.txt"
            Path(result).rename(new_path)
            return str(new_path)
        return result
    except Exception:
        logger.exception("Podcastfy transcript generation failed")
        return None


def _parse_transcript(text: str) -> list[ScriptLine]:
    """Parse Podcastfy's <Person1>/<Person2> XML transcript into ScriptLines."""
    # Strip any LLM scratchpad/thinking that precedes the actual dialogue
    text = _SCRATCHPAD_PATTERN.sub("", text)
    lines: list[ScriptLine] = []
    for match in _TAG_PATTERN.finditer(text):
        tag, content = match.group(1), match.group(2).strip()
        speaker = _SPEAKER_MAP.get(tag, "Alex")
        if content:
            lines.append(ScriptLine(speaker=speaker, text=content))
    return lines
