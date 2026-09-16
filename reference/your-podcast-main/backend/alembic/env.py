import sys
from logging.config import fileConfig
from pathlib import Path

# Ensure backend/ is on sys.path so `app` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.db.tables import metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = metadata

# Allow overriding DB URL via -x db_url=...
cmd_opts = context.get_x_argument(as_dictionary=True)
if "db_url" in cmd_opts:
    config.set_main_option("sqlalchemy.url", cmd_opts["db_url"])


def run_migrations_offline() -> None:
    """Generate SQL scripts (used by migrate_d1.py for D1 deployments)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a real database (local SQLite)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
