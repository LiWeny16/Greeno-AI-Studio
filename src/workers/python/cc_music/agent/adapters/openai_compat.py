"""OpenAI-compatible adapter using httpx.

Calls any OpenAI-compatible /v1/chat/completions endpoint.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from cc_music.agent.loop import LlmResponse, ToolCall


class OpenAiCompatBackend:
    """Calls any OpenAI-compatible /v1/chat/completions endpoint via httpx."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        model: str = "llama3",
        api_key: str = "not-needed",
    ) -> None:
        """Create an OpenAI-compatible backend.

        Args:
            base_url: Base URL of the OpenAI-compatible API (e.g. Ollama,
                      LM Studio, vLLM, or OpenAI itself).
            model: Model name to use for requests.
            api_key: API key for the endpoint. Defaults to "not-needed" for
                     local endpoints that don't require auth.
        """
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazily create and return the shared httpx AsyncClient."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))
        return self._client

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def chat(
        self, system: str, messages: list[dict], tools: list[dict]
    ) -> LlmResponse:
        """POST {base_url}/chat/completions and parse the response.

        Response parsing logic:
          - message.tool_calls present -> LlmResponse(tool_calls=[...])
          - message.content parses as JSON with a "patch" key -> LlmResponse(proposal={...})
          - message.content is plain text -> LlmResponse(text="...")
          - Empty/nil response -> LlmResponse(text="")

        HTTP and JSON errors are caught and returned as text responses so the
        agent loop can handle them without crashing.
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                *messages,
            ],
        }
        if tools:
            payload["tools"] = tools

        client = await self._get_client()
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key and self.api_key != "not-needed":
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            return LlmResponse(
                text=f"HTTP error {exc.response.status_code}: "
                f"{exc.response.text[:500]}"
            )
        except (httpx.RequestError, json.JSONDecodeError) as exc:
            return LlmResponse(text=f"Request error: {exc}")

        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})

        # -- Branch: tool_calls --
        raw_tool_calls: list[dict] = message.get("tool_calls", [])
        if raw_tool_calls:
            tool_calls: list[ToolCall] = []
            for tc in raw_tool_calls:
                fn = tc.get("function", {})
                raw_args: str = fn.get("arguments", "{}")
                try:
                    arguments = json.loads(raw_args)
                except json.JSONDecodeError:
                    arguments = {}
                tool_calls.append(
                    ToolCall(
                        id=tc.get("id", ""),
                        name=fn.get("name", ""),
                        arguments=arguments,
                    )
                )
            return LlmResponse(tool_calls=tool_calls)

        # -- Branch: text content --
        content: str = message.get("content", "") or ""
        if content.strip():
            # Attempt to interpret content as a JSON proposal
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict) and "patch" in parsed:
                    return LlmResponse(proposal=parsed)
            except json.JSONDecodeError:
                pass
            return LlmResponse(text=content)

        # -- Branch: empty response --
        return LlmResponse(text="")
