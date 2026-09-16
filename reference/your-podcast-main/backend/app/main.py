import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import get_settings
from app.routers import auth, episodes, generate, onboarding, tasks

logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the shared DB client at startup (no lazy-init race).
    # Tolerate init failure so health check still works in CI/staging
    # where DB credentials may not be available.
    from app.db.client import init_db
    db = None
    try:
        db = init_db()
    except Exception:
        logger.warning("DB init failed at startup — endpoints requiring DB will error", exc_info=True)
    yield
    if db is not None:
        await db.aclose()


app = FastAPI(title="Your Podcast API", lifespan=lifespan)

# Trust proxy headers (X-Forwarded-Proto, X-Forwarded-For) so that
# request.url_for() generates https:// URLs behind Railway's reverse proxy.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# SessionMiddleware is required by authlib for OAuth state storage
# https_only=True ensures the Secure flag is set in production (behind proxy,
# Starlette sees HTTP and would otherwise omit it, causing browsers to drop the cookie).
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    https_only=not settings.is_dev,
)

origins = [
    "http://localhost:3000",
    "https://your-podcast.vercel.app",
    os.getenv("FRONTEND_URL", ""),
]

# In dev, allow LAN origins for mobile testing
dev_origin_regex = None
if settings.is_dev:
    origins.append("http://localhost:3001")
    # Allow any device on RFC 1918 LAN subnets (any port)
    dev_origin_regex = r"http://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in origins if o],
    allow_origin_regex=dev_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(episodes.router)
app.include_router(generate.router)
app.include_router(tasks.router)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.2.1", "environment": settings.environment}
