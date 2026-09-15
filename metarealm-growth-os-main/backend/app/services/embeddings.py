"""Embedding provider — Ollama (nomic-embed-text) with graceful absence.

Every function returns None when Ollama is unreachable so callers can
fall back to keyword search instead of failing.
"""

import httpx

from app.core.config import settings


def embed_texts(texts: list[str]) -> list[list[float]] | None:
    if not texts:
        return []
    try:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/embed",
            json={"model": settings.EMBED_MODEL, "input": texts},
            timeout=120,
        )
        response.raise_for_status()
        embeddings = response.json().get("embeddings")
        if not embeddings or len(embeddings) != len(texts):
            return None
        return embeddings
    except Exception:
        return None


def embed_query(text: str) -> list[float] | None:
    result = embed_texts([text])
    return result[0] if result else None


def embed_texts_batched(
    texts: list[str], batch_size: int = 16
) -> tuple[list[list[float] | None], bool]:
    """Embed in small batches so one long request can never hang a sync.
    Returns (vectors, all_ok). Failed batches yield None per text."""
    vectors: list[list[float] | None] = []
    all_ok = True
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        result = embed_texts(batch)
        if result is None:
            vectors.extend([None] * len(batch))
            all_ok = False
        else:
            vectors.extend(result)
    return vectors, all_ok
