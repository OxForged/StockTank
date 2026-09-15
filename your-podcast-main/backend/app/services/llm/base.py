"""LLM client protocol — adapter interface for text generation."""

from typing import Protocol


class LLMClient(Protocol):
    """Minimal interface that all LLM adapters must implement."""

    def chat(self, prompt: str) -> str:
        """Send a prompt and return the text response."""
        ...
