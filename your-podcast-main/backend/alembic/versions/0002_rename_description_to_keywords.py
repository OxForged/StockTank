"""rename description to keywords

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("episode", "description", new_column_name="keywords")
    op.execute("UPDATE episode SET keywords = '[]' WHERE keywords = '' OR keywords IS NULL")


def downgrade() -> None:
    op.alter_column("episode", "keywords", new_column_name="description")
