"""Shared Pydantic base: camelCase on the wire, snake_case in Python.

This is what keeps backend/app/schemas byte-compatible with frontend/types.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
