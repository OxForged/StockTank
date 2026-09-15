from app.schemas.base import CamelModel


class KnowledgeDocumentOut(CamelModel):
    id: str
    title: str
    filename: str
    kind: str
    chunk_count: int
    embedded: bool


class PassageOut(CamelModel):
    document_title: str
    page: int | None = None
    text: str
    score: float


class AskRequest(CamelModel):
    question: str


class AskResponse(CamelModel):
    answer: str | None = None
    used_llm: bool
    passages: list[PassageOut]


class SyncResponse(CamelModel):
    ingested: list[str]
    reindexed: list[str]
    embedded_backfilled: list[str]
    skipped: int
    failed: list[str] = []
    embeddings_available: bool
