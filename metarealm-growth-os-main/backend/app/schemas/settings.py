from app.schemas.base import CamelModel


class SettingUpdate(CamelModel):
    key: str
    value: str


class PromptOut(CamelModel):
    name: str
    content: str


class PromptUpdate(CamelModel):
    content: str
