"""Podcast cover image generation using Google Imagen (Gemini image model).

Falls back to placeholder gradient URLs on failure.
"""

import hashlib
import logging
import tempfile
import urllib.parse
from pathlib import Path

from google import genai
from google.genai.types import GenerateContentConfig, ImageConfig

from app.config import Settings

logger = logging.getLogger(__name__)

_MODEL = "gemini-3-pro-image-preview"

_GRADIENTS = [
    ("6366f1", "a855f7"),  # indigo -> purple
    ("ec4899", "f43f5e"),  # pink -> rose
    ("f59e0b", "ef4444"),  # amber -> red
    ("10b981", "06b6d4"),  # emerald -> cyan
    ("3b82f6", "8b5cf6"),  # blue -> violet
    ("14b8a6", "22d3ee"),  # teal -> cyan
    ("f97316", "facc15"),  # orange -> yellow
    ("8b5cf6", "ec4899"),  # violet -> pink
]


def generate_cover_url(title: str) -> str:
    """Generate a deterministic placeholder cover URL based on episode title."""
    digest = hashlib.md5(title.encode(), usedforsecurity=False).hexdigest()
    idx = int(digest, 16) % len(_GRADIENTS)
    bg, fg = _GRADIENTS[idx]

    encoded_title = urllib.parse.quote(title[:20])
    return f"https://placehold.co/800x800/{bg}/{fg}.png?text={encoded_title}"


def _create_client(settings: Settings) -> genai.Client:
    """Create a genai client, preferring Vertex AI if configured."""
    if settings.vertex_project_id:
        return genai.Client(
            vertexai=True,
            project=settings.vertex_project_id,
            location=settings.vertex_location,
        )
    if settings.gemini_api_key:
        return genai.Client(api_key=settings.gemini_api_key)
    raise ValueError("No Vertex AI project or Gemini API key configured")


async def generate_cover(
    title: str, keywords: list[str], settings: Settings
) -> Path | None:
    """Generate a podcast cover image using Google Imagen.

    Prefers Vertex AI if vertex_project_id is set, otherwise falls back to API key.
    Returns the path to a temp PNG file, or None on failure.
    """
    if not settings.vertex_project_id and not settings.gemini_api_key:
        logger.warning("No Vertex AI project or Gemini API key, skipping cover generation")
        return None

    topics = ", ".join(keywords[:3]) if keywords else "technology"
    prompt = (
        f"Single simple icon about {topics}. "
        "Minimal flat design, one centered object, solid pastel background. "
        "No text, no letters, no words, no numbers, no details."
    )

    try:
        client = _create_client(settings)
        response = client.models.generate_content(
            model=_MODEL,
            contents=prompt,
            config=GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=ImageConfig(aspect_ratio="1:1"),
                candidate_count=1,
            ),
        )

        if not response.candidates or not response.candidates[0].content.parts:
            logger.warning("Imagen returned no images")
            return None

        for part in response.candidates[0].content.parts:
            if part.inline_data:
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                    tmp.write(part.inline_data.data)
                logger.info("Generated cover image: %s", tmp.name)
                return Path(tmp.name)

        logger.warning("Imagen response had no image data")
        return None

    except Exception:
        logger.exception("Cover generation failed")
        return None
