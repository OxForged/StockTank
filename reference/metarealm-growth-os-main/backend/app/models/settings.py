"""Runtime settings — key/value overrides editable from the Settings page.

These win over the .env defaults, so you can paste an API key or change
which employees are premium without touching files or restarting.
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
