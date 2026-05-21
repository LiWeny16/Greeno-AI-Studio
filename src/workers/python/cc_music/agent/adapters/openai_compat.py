"""OpenAI-compatible adapter stub.

Will use httpx to call any OpenAI-compatible endpoint
(base_url, api_key, model name configurable).
"""

from typing import Any


class OpenAICompatAdapter:
    """Stub adapter for OpenAI-compatible LLM endpoints."""

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def chat_completion(
        self, messages: list[dict], tools: list[dict] | None = None
    ) -> dict[str, Any]:
        """Send a chat completion request. Stub implementation."""
        raise NotImplementedError(
            "OpenAI-compatible adapter is a stub — no real HTTP calls yet."
        )
