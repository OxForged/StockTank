"""Knowledge base engine — ingestion, retrieval, and cited answers.

Pipeline: extract (pdf/md/txt) → chunk (~1200 chars, soft boundaries)
→ embed via Ollama when available → store. Retrieval uses cosine over
stored vectors, falling back to keyword scoring when embeddings are
missing, so the feature always answers.
"""

from __future__ import annotations

import math
import re
import uuid
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import KnowledgeChunk, KnowledgeDocument
from app.services.embeddings import embed_query, embed_texts, embed_texts_batched
from app.services.llm import generate, load_prompt, render_prompt

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150
SUPPORTED_SUFFIXES = {".pdf", ".md", ".txt"}

STOPWORDS = {
    "the", "and", "for", "are", "was", "were", "what", "how", "does", "did",
    "with", "that", "this", "from", "you", "your", "has", "have", "had",
    "who", "when", "where", "which", "why", "much", "many", "our", "their",
    "them", "will", "can", "could", "would", "should", "about", "into",
}

DEFAULT_ANSWER_PROMPT = """Answer the question using ONLY the context passages below. Be concise. Quote exact numbers when they appear, and cite sources in parentheses like (document title, page N). If the context does not contain the answer, say so plainly.

Question:
{question}

Context passages:
{context}

Answer:"""


def explain_ingest_error(filename: str, error: Exception) -> str:
    """Turn a library error into plain advice the founder can act on."""
    name = type(error).__name__
    text = str(error).lower()
    if "pdfstream" in name.lower() or "eof" in text or "startxref" in text:
        return (
            f"{filename} looks damaged or is not a real PDF. Try opening it "
            "and re-saving, or export it again from the original tool."
        )
    if "encrypt" in text or "password" in text:
        return (
            f"{filename} is password protected. Remove the password, then "
            "upload it again."
        )
    return (
        f"Could not read {filename} ({name}). Supported files are .pdf with "
        "real text, .md, and .txt."
    )


def knowledge_dir() -> Path:
    return Path(settings.KNOWLEDGE_DIR)


def _title_from_filename(name: str) -> str:
    cleaned = Path(name).stem.replace("-", " ").replace("_", " ").strip()
    return cleaned[:1].upper() + cleaned[1:] if cleaned else name


def _extract(path: Path) -> list[tuple[int | None, str]]:
    """Return (page, text) blocks. Page numbers only exist for PDFs."""
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
    return [(None, path.read_text(encoding="utf-8", errors="ignore"))]


def _chunk(blocks: list[tuple[int | None, str]]) -> list[tuple[int | None, str]]:
    chunks: list[tuple[int | None, str]] = []
    for page, raw in blocks:
        text = re.sub(r"[ \t]+", " ", raw)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            continue
        start = 0
        while start < len(text):
            end = min(start + CHUNK_SIZE, len(text))
            if end < len(text):
                soft = text.rfind("\n\n", start, end)
                if soft <= start + 300:
                    soft = text.rfind(". ", start + 300, end)
                if soft > start + 300:
                    end = soft + 1
            piece = text[start:end].strip()
            if piece:
                chunks.append((page, piece))
            if end >= len(text):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def ingest_file(db: Session, path: Path) -> KnowledgeDocument:
    """(Re)ingest one file: replace chunks, refresh embeddings if possible."""
    stat = path.stat()
    # Extract FIRST, before touching the database. If the file is bad, we
    # fail here and never leave a half written row behind.
    chunks = _chunk(_extract(path))

    # Idempotent: if this filename exists, remove it and its chunks fully,
    # then recreate. This makes re-uploading the same file always safe.
    existing = db.scalar(
        select(KnowledgeDocument).where(KnowledgeDocument.filename == path.name)
    )
    if existing:
        db.execute(
            delete(KnowledgeChunk).where(KnowledgeChunk.document_id == existing.id)
        )
        db.delete(existing)
        db.flush()

    document = KnowledgeDocument(
        id=f"doc-{uuid.uuid4().hex[:8]}",
        filename=path.name,
        title=_title_from_filename(path.name),
        kind=path.suffix.lstrip(".").lower(),
    )
    db.add(document)
    db.flush()
    vectors, all_ok = embed_texts_batched([text for _, text in chunks])
    for index, (page, text) in enumerate(chunks):
        db.add(
            KnowledgeChunk(
                id=f"chk-{uuid.uuid4().hex[:10]}",
                document_id=document.id,
                ordinal=index,
                page=page,
                text=text,
                embedding=vectors[index],
            )
        )
    document.chunk_count = len(chunks)
    document.embedded = all_ok and len(chunks) > 0
    document.file_mtime = stat.st_mtime
    document.file_size = stat.st_size
    db.commit()
    db.refresh(document)
    return document


def sync_folder(db: Session) -> dict:
    """Index new/changed files in knowledge/; backfill embeddings when
    Ollama has come online since a document was first indexed."""
    ingested: list[str] = []
    reindexed: list[str] = []
    backfilled: list[str] = []
    skipped = 0

    folder = knowledge_dir()
    folder.mkdir(parents=True, exist_ok=True)
    files = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES
    )

    failed: list[str] = []
    for path in files:
        existing = db.scalar(
            select(KnowledgeDocument).where(
                KnowledgeDocument.filename == path.name
            )
        )
        try:
            if existing is None:
                ingest_file(db, path)
                ingested.append(path.name)
            elif existing.file_mtime != path.stat().st_mtime:
                ingest_file(db, path)
                reindexed.append(path.name)
            else:
                skipped += 1
        except Exception as error:
            # One unreadable file must never kill the whole sync.
            db.rollback()
            failed.append(f"{path.name} ({type(error).__name__})")

    # Backfill: documents indexed while Ollama was down get vectors now.
    embeddings_available = embed_query("ping") is not None
    if embeddings_available:
        pending = db.scalars(
            select(KnowledgeDocument).where(KnowledgeDocument.embedded == False)  # noqa: E712
        ).all()
        for document in pending:
            chunks = db.scalars(
                select(KnowledgeChunk)
                .where(KnowledgeChunk.document_id == document.id)
                .order_by(KnowledgeChunk.ordinal)
            ).all()
            vectors = embed_texts([chunk.text for chunk in chunks])
            if vectors:
                for chunk, vector in zip(chunks, vectors):
                    chunk.embedding = vector
                document.embedded = True
                backfilled.append(document.filename)
        db.commit()

    return {
        "ingested": ingested,
        "reindexed": reindexed,
        "embedded_backfilled": backfilled,
        "skipped": skipped,
        "failed": failed,
        "embeddings_available": embeddings_available,
    }


def search(db: Session, query: str, top_k: int = 5) -> list[dict]:
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDocument.title).join(
            KnowledgeDocument,
            KnowledgeChunk.document_id == KnowledgeDocument.id,
        )
    ).all()
    if not rows:
        return []

    query_embedding = embed_query(query)
    scored: list[tuple[float, KnowledgeChunk, str]] = []

    if query_embedding:
        for chunk, title in rows:
            if chunk.embedding:
                scored.append((_cosine(query_embedding, chunk.embedding), chunk, title))
        scored = [entry for entry in scored if entry[0] > 0.25]

    if not scored:
        # Keyword fallback — also the path when Ollama is offline.
        # Coverage of DISTINCT terms dominates; raw frequency only breaks
        # ties, so a page repeating one common word cannot outrank the
        # passage that actually answers the question.
        terms = list(
            dict.fromkeys(
                t
                for t in re.findall(r"[a-z0-9.%]+", query.lower())
                if len(t) > 2 and t not in STOPWORDS
            )
        )
        query_lower = query.lower()
        for chunk, title in rows:
            text_lower = chunk.text.lower()
            matched = [term for term in terms if term in text_lower]
            if not matched:
                continue
            coverage = len(matched) / len(terms) if terms else 0.0
            frequency = sum(text_lower.count(term) for term in matched)
            digit_bonus = sum(
                4.0 for term in matched if any(ch.isdigit() for ch in term)
            )
            phrase_bonus = 6.0 if query_lower in text_lower else 0.0
            score = (
                coverage * 10.0
                + min(frequency, 20) * 0.2
                + digit_bonus
                + phrase_bonus
            )
            scored.append((score, chunk, title))

    scored.sort(key=lambda entry: entry[0], reverse=True)
    return [
        {
            "document_title": title,
            "page": chunk.page,
            "text": chunk.text,
            "score": round(score, 4),
        }
        for score, chunk, title in scored[:top_k]
    ]


def ask(db: Session, question: str) -> dict:
    passages = search(db, question, top_k=5)
    answer: str | None = None

    if passages:
        context = "\n\n".join(
            f"[{index + 1}] (Source: {p['document_title']}"
            + (f", page {p['page']}" if p["page"] else "")
            + f")\n{p['text']}"
            for index, p in enumerate(passages)
        )
        template = load_prompt("knowledge-answer", DEFAULT_ANSWER_PROMPT)
        answer = generate(render_prompt(template, question=question, context=context))

    return {
        "answer": answer,
        "used_llm": answer is not None,
        "passages": passages,
    }
