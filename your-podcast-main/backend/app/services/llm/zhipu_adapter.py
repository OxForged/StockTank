"""ZhiPu AI adapter — wraps zhipuai SDK (open.bigmodel.cn)."""

from zhipuai import ZhipuAI


class ZhipuClient:
    def __init__(self, api_key: str, model: str = "glm-5") -> None:
        self._client = ZhipuAI(api_key=api_key)
        self._model = model

    def chat(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content
