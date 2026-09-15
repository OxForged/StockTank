FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . /app
RUN uv sync --frozen --no-dev

# Remove heavy transitive deps from podcastfy that we don't use at runtime
RUN .venv/bin/pip uninstall -y \
    pymupdf pyarrow pandas numpy cython \
    sphinx sphinx-rtd-theme sphinx-autodoc-typehints nbsphinx \
    elevenlabs google-cloud-texttospeech \
    pytest pytest-xdist \
    wheel setuptools 2>/dev/null; \
    find .venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null; \
    find .venv -type d -name "tests" -exec rm -rf {} + 2>/dev/null; \
    find .venv -type d -name "test" -exec rm -rf {} + 2>/dev/null; \
    rm -rf .venv/lib/python*/site-packages/pip 2>/dev/null; \
    rm -rf /root/.cache /tmp/* 2>/dev/null; \
    true

ENV PATH="/app/.venv/bin:$PATH"

CMD ["sh", "-c", "echo 'Starting app...' && mkdir -p data && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
