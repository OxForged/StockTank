#!/usr/bin/env python
"""Apply Alembic migrations to Cloudflare D1.

Uses Alembic offline mode to generate SQL, then sends it to D1 via REST API.

Usage:
    python migrate_d1.py upgrade head              # apply all pending migrations
    python migrate_d1.py upgrade head --dry-run    # show SQL without executing
    python migrate_d1.py stamp 0001               # mark D1 as being at revision 0001
    python migrate_d1.py current                   # show current D1 revision
"""

import argparse
import asyncio
import io
import sqlite3
import sys
from pathlib import Path

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from alembic import command
from alembic.config import Config


def _get_alembic_config() -> Config:
    ini_path = Path(__file__).resolve().parent / "alembic.ini"
    return Config(str(ini_path))


def _capture_offline_sql(target_rev: str, starting_rev: str | None = None) -> str:
    """Run Alembic in offline mode and capture the generated SQL."""
    cfg = _get_alembic_config()
    # Use a dummy URL — offline mode doesn't connect
    cfg.set_main_option("sqlalchemy.url", "sqlite://")

    buf = io.StringIO()
    cfg.output_buffer = buf  # type: ignore[attr-defined]

    # Use "from:to" range so only pending migrations are generated
    if starting_rev:
        revision_range = f"{starting_rev}:{target_rev}"
    else:
        revision_range = target_rev

    command.upgrade(cfg, revision_range, sql=True)
    return buf.getvalue()


def _strip_returning(sql: str) -> str:
    """Remove RETURNING clauses that D1 doesn't support."""
    import re
    return re.sub(r"\s+RETURNING\b.+", "", sql, flags=re.IGNORECASE | re.DOTALL)


def _split_sql_statements(sql: str) -> list[str]:
    """Split Alembic-generated SQL into executable statements safely."""
    statements: list[str] = []
    current: list[str] = []

    for raw_line in sql.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        current.append(raw_line)
        candidate = "\n".join(current).strip()
        if sqlite3.complete_statement(candidate):
            statement = candidate.rstrip().rstrip(";").strip()
            if statement:
                statements.append(_strip_returning(statement))
            current.clear()

    if current:
        raise ValueError("Failed to split generated SQL into complete statements.")

    return statements


async def _get_d1_client():
    from app.services.d1 import get_d1_client
    return get_d1_client()


async def _run_upgrade(target: str, dry_run: bool = False) -> None:
    # Dry-run doesn't need D1 credentials — generate all SQL from scratch
    current_rev = None if dry_run else await _get_current_rev(auto_stamp=True)

    sql = _capture_offline_sql(target, starting_rev=current_rev)
    if not sql.strip():
        print("No pending migrations.")
        return

    sql_statements = _split_sql_statements(sql)

    if dry_run:
        print("=== DRY RUN — SQL that would be sent to D1 ===\n")
        for stmt in sql_statements:
            print(f"{stmt};\n")
        print(f"=== {len(sql_statements)} statement(s) total ===")
        return

    db = await _get_d1_client()
    try:
        print(f"Applying {len(sql_statements)} statement(s) to D1...")
        batch = [{"sql": stmt} for stmt in sql_statements]
        await db.batch(batch)
        print("Migrations applied successfully.")
    finally:
        await db.aclose()


async def _get_current_rev(auto_stamp: bool = False) -> str | None:
    """Query D1 for the current alembic_version.

    If auto_stamp=True and no alembic_version table exists but application tables
    do (pre-Alembic DB), auto-stamp at the initial revision so migrations don't
    try to recreate tables.
    """
    db = await _get_d1_client()
    try:
        # Check if alembic_version table exists
        rows = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'"
        )
        if not rows:
            if auto_stamp:
                # Check if this is a pre-Alembic DB (tables exist but no version tracking)
                tables = await db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
                )
                if tables:
                    print("Detected pre-Alembic D1 database. Auto-stamping at 0001...")
                    await db.batch([
                        {
                            "sql": """CREATE TABLE IF NOT EXISTS alembic_version (
                                version_num VARCHAR(32) NOT NULL,
                                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                            )"""
                        },
                        {"sql": "INSERT INTO alembic_version (version_num) VALUES (?)", "params": ["0001"]},
                    ])
                    return "0001"
            return None
        rows = await db.execute("SELECT version_num FROM alembic_version")
        return rows[0]["version_num"] if rows else None
    finally:
        await db.aclose()


async def _run_current() -> None:
    rev = await _get_current_rev()
    if rev:
        print(f"Current D1 revision: {rev}")
    else:
        print("No alembic_version table found (D1 not yet stamped).")


async def _run_stamp(revision: str) -> None:
    """Stamp D1 with a revision without running migrations."""
    db = await _get_d1_client()
    try:
        await db.batch([
            {
                "sql": """CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )"""
            },
            {"sql": "DELETE FROM alembic_version"},
            {"sql": "INSERT INTO alembic_version (version_num) VALUES (?)", "params": [revision]},
        ])
        print(f"D1 stamped at revision: {revision}")
    finally:
        await db.aclose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Alembic migrations to D1")
    sub = parser.add_subparsers(dest="command", required=True)

    upgrade_p = sub.add_parser("upgrade", help="Apply migrations")
    upgrade_p.add_argument("revision", default="head", nargs="?")
    upgrade_p.add_argument("--dry-run", action="store_true", help="Show SQL without executing")

    stamp_p = sub.add_parser("stamp", help="Stamp D1 at a revision")
    stamp_p.add_argument("revision")

    sub.add_parser("current", help="Show current D1 revision")

    args = parser.parse_args()

    if args.command == "upgrade":
        asyncio.run(_run_upgrade(args.revision, dry_run=args.dry_run))
    elif args.command == "stamp":
        asyncio.run(_run_stamp(args.revision))
    elif args.command == "current":
        asyncio.run(_run_current())


if __name__ == "__main__":
    main()
