import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import KnowledgeChunk, KnowledgeDocument
from app.schemas import (
    AskRequest,
    AskResponse,
    KnowledgeDocumentOut,
    SyncResponse,
)
from app.services import rag

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

MAX_UPLOAD_MB = 25


@router.get("/documents", response_model=list[KnowledgeDocumentOut])
def list_documents(db: Session = Depends(get_db)):
    return db.scalars(
        select(KnowledgeDocument).order_by(KnowledgeDocument.title)
    ).all()


@router.post("/documents", response_model=KnowledgeDocumentOut, status_code=201)
async def upload_document(file: UploadFile, db: Session = Depends(get_db)):
    name = Path(file.filename or "").name
    suffix = Path(name).suffix.lower()
    if suffix not in rag.SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=400, detail="Only .pdf, .md, and .txt files are supported"
        )
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=413,
            detail=(
                f"That file is {size_mb:.0f} MB. The limit is {MAX_UPLOAD_MB} MB. "
                "Big decks are often mostly images. Export a lighter PDF, or "
                "put the key facts in a .txt or .md file."
            ),
        )
    safe_name = re.sub(r"[^A-Za-z0-9._ -]", "", name).strip() or f"upload{suffix}"
    target = rag.knowledge_dir() / safe_name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(contents)
    try:
        document = rag.ingest_file(db, target)
    except Exception as error:
        db.rollback()
        target.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422, detail=rag.explain_ingest_error(safe_name, error)
        ) from error

    # A PDF that parsed but produced no text is almost always a scanned
    # document, images of pages with no real text inside. Tell the user
    # plainly instead of silently saving an empty, useless document.
    if document.chunk_count == 0:
        db.delete(document)
        db.commit()
        target.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail=(
                f"{safe_name} has no readable text. If it is a scanned PDF "
                "(pictures of pages), export it as text first, or paste the "
                "key facts into a .txt or .md file and upload that."
            ),
        )
    return document


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    document = db.get(KnowledgeDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document.id)
    )
    file_path = rag.knowledge_dir() / document.filename
    db.delete(document)
    db.commit()
    if file_path.exists():
        file_path.unlink()


@router.post("/sync", response_model=SyncResponse)
def sync(db: Session = Depends(get_db)):
    return rag.sync_folder(db)


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest, db: Session = Depends(get_db)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")
    return rag.ask(db, question)
