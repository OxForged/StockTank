from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect

from app.api import api_router
from app.core.config import settings
from app.core.db import Base, engine
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # If Alembic has already stamped this database (alembic_version
    # exists), Alembic owns the schema and create_all must stay out of
    # the way. Only run create_all on a brand new database that has
    # never seen a migration, so a plain `uvicorn app.main:app` on
    # SQLite still works with zero setup.
    if not inspect(engine).has_table("alembic_version"):
        Base.metadata.create_all(bind=engine)
    if settings.AUTO_SEED:
        seed_if_empty()
    from app.core.db import SessionLocal
    from app.services.runtime_settings import apply_overrides
    with SessionLocal() as db:
        apply_overrides(db)
    Path(settings.UPLOADS_DIR, "proposals").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="MetaRealm OS API", version="0.7.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_error(request, exc):
    """Any crash returns a clear JSON message instead of a dead connection,
    so the UI can show what actually went wrong."""
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error, {type(exc).__name__}: {str(exc)[:200]}"},
        headers={"Access-Control-Allow-Origin": "*"},
    )


app.include_router(api_router)

# Generated files (proposals) are downloadable straight from the API.
app.mount(
    "/uploads",
    StaticFiles(directory=settings.UPLOADS_DIR, check_dir=False),
    name="uploads",
)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}
