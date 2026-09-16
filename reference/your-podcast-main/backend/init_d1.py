#!/usr/bin/env python
"""Initialize database schema.

Thin wrapper around Alembic migrations:
  - sqlite: runs `alembic upgrade head`
  - d1: delegates to `migrate_d1.py upgrade head`

Usage:
    python init_d1.py
"""

import subprocess
import sys
from pathlib import Path

from app.config import get_settings


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    settings = get_settings()

    if settings.database_backend == "d1":
        print("DATABASE_BACKEND=d1 — running migrate_d1.py upgrade head")
        result = subprocess.run(
            [sys.executable, "migrate_d1.py", "upgrade", "head"],
            cwd=backend_dir,
        )
    else:
        print("DATABASE_BACKEND=sqlite — running alembic upgrade head (local SQLite)")
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
        )

    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
