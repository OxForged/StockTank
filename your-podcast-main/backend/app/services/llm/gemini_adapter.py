"""Gemini adapter — wraps google.genai for text generation."""

from google import genai


class GeminiClient:
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash") -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model

    def chat(self, prompt: str) -> str:
        response = self._client.models.generate_content(
            model=self._model, contents=prompt
        )
        return response.text
