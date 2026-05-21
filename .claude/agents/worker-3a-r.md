---
name: worker-3a-r
description: Wave 3A Worker R - Python LLM adapters (OpenAI-compatible httpx backend + deterministic mock backend)
---

# Worker 3A-R: Python LLM Adapters

You are Worker 3A-R on CC Music. Implement the LLM backend adapters for the ReAct agent loop in Python. Build two backends: a full OpenAI-compatible adapter using httpx (not a stub) and a deterministic mock adapter for testing.

## Task

Implement two Python files:
1. `src/workers/python/cc_music/agent/adapters/openai_compat.py` — full httpx implementation, not stub
2. `src/workers/python/cc_music/agent/adapters/mock.py` — deterministic ReAct loop for tests

Both must implement the `LlmBackend` protocol from `loop.py`. No TypeScript. No LangGraph.

## Allowed Files

- `src/workers/python/cc_music/agent/adapters/openai_compat.py`
- `src/workers/python/cc_music/agent/adapters/mock.py`
- `src/workers/python/cc_music/agent/adapters/__init__.py` (update exports)

## Forbidden Files

- ReAct loop core (Worker 3A-P)
- Tool implementations (Worker 3A-Q)
- JSON-RPC server (Worker 3A-S)
- `docs/**`, `src/studio-web/**`, any TypeScript files

## Inputs

- `LlmBackend` protocol from `src/workers/python/cc_music/agent/loop.py`
- `LlmResponse`, `ToolCall` dataclasses from `src/workers/python/cc_music/agent/loop.py`
- `docs/arch.md` Section 7.5 (LLM adapter interface)

## 1. OpenAiCompatBackend (`openai_compat.py`)

Full httpx implementation — NOT a stub. Must make real HTTP calls to any OpenAI-compatible endpoint.

```python
class OpenAiCompatBackend:
    def __init__(self, base_url: str, api_key: str, model: str,
                 timeout_seconds: float = 120.0, max_retries: int = 2):
        ...

    async def chat(self, system: str, messages: list[dict],
                   tools: list[dict]) -> LlmResponse:
        ...
```

### HTTP Implementation Details

- Use `httpx.AsyncClient` with configurable timeout
- POST to `{base_url}/chat/completions` (strip trailing slash from base_url)
- Headers: `Authorization: Bearer {api_key}`, `Content-Type: application/json`
- Request body:
  ```json
  {
    "model": "<model>",
    "messages": [
      {"role": "system", "content": "<system>"},
      ...messages
    ],
    "tools": [...tool_schemas],
    "temperature": 0.1,
    "max_tokens": 4096
  }
  ```
- Parse response:
  - `choices[0].message.content` -> `LlmResponse.text`
  - `choices[0].message.tool_calls` -> `LlmResponse.tool_calls` (map id, function.name, function.arguments (JSON-parse))
  - No content and no tool_calls and finish_reason == "stop" with empty content -> `LlmResponse(text="")`
- On HTTP error (4xx, 5xx): raise `RuntimeError` with status code and response body snippet
- On timeout: raise `TimeoutError` with meaningful message
- On JSON decode error in tool arguments: wrap as `ToolCall` with arguments={} and log warning
- Environment variable support: `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` as defaults if constructor args not provided
- Include `max_retries` with exponential backoff (1s, 4s) on 429 and 5xx responses

## 2. MockBackend (`mock.py`)

Deterministic backend for tests. Never calls a real LLM endpoint. Returns pre-configured `LlmResponse` sequences.

### MockBackend Class

```python
class MockBackend:
    PROMPTS: ClassVar[dict[str, list[LlmResponse]]] = {...}

    def __init__(self, responses: list[LlmResponse] | None = None):
        self._responses = list(responses) if responses else []
        self._index = 0
        self.calls: list[dict] = []   # Track every chat() call for assertions

    @classmethod
    def from_prompt(cls, prompt_key: str) -> MockBackend:
        """Factory: create from named PROMPTS entry."""
        ...

    async def chat(self, system: str, messages: list[dict],
                   tools: list[dict]) -> LlmResponse:
        """Return next pre-configured response. Track call. Return empty on exhaustion."""
        ...
```

### Known Prompt -> Fixed Response Mappings (PROMPTS dict)

Each entry maps a prompt key to a list of LlmResponse objects that simulate a full ReAct trajectory:

- **"make bars 9-16 darker"**: 6 responses — analyze text -> analyze_motif tool call -> plan text -> generate_bassline tool call -> validation text -> valid proposal
- **"add bassline to section A"**: 4 responses — analyze_chord_progression tool call -> plan text -> generate_bassline tool call -> valid proposal
- **"vary motif_main"**: 4 responses — analyze_motif tool call -> plan text -> generate_motif_variation tool call -> valid proposal
- **"fail:invalid_json"**: 2 responses — text -> proposal with unparseable JSON (string, not dict) that triggers validation failure
- **"fail:schema_invalid"**: 4 responses — text -> invalid proposal (missing "patch") -> validation error feedback -> retry with valid proposal
- **"fail:timeout"**: 10+ text-only responses that never produce a proposal, causing max_iterations
- **"fail:cancelled"**: Use a `_cancelled` flag; when set during a chat call, raise `asyncio.CancelledError`
- **"fail:max_iterations"**: 11 text-only responses -> loop exhausts max_iterations=10
- **"fail:adapter_failed"**: Raise `RuntimeError("Mock adapter failure simulation")` on the first chat call

### Sample Proposal Fixtures

Define class-level fixtures used by the PROMPTS entries:

```python
_VALID_PROPOSAL = {
    "patch": [
        {"op": "replace", "path": "/sections/1/style/genre", "value": "dark minimal electronic"},
        {"op": "add", "path": "/sections/1/tracks/-", "value": {"id": "bass_01", "instrument": "bass", "notes": []}},
    ],
    "musicalDiff": {
        "barsChanged": [9, 16],
        "notesAdded": 12, "notesRemoved": 4,
        "preservedMotifs": ["motif_main"],
    },
}

_INVALID_PROPOSAL = {
    "musicalDiff": {"barsChanged": [], "notesAdded": 0, "notesRemoved": 0},
}
```

### Call Tracking

Each `chat()` call must append to `self.calls`:
```python
{"system": str, "messages": list[dict], "tools": list[dict]}
```
This enables test assertions: `assert len(backend.calls) == 6`, `assert backend.calls[0]["system"] == expected_prompt`.

## Acceptance Criteria

### OpenAiCompatBackend
- `chat()` constructs correct HTTP request to `{base_url}/chat/completions`
- Handles 200 response with content, tool_calls, and empty finish
- Handles 401 (auth error), 429 (rate limit with retry), 500 (server error)
- Handles connection timeout
- Handles malformed JSON in tool call arguments gracefully
- Unit tests use `pytest-httpx` to mock HTTP, no real API calls

### MockBackend
- `from_prompt("make bars 9-16 darker")` returns 6-response sequence
- All 9 prompt keys in PROMPTS produce correct `LlmResponse` sequences
- All 5 failure modes (invalid_json, schema_invalid, timeout, cancelled, max_iterations, adapter_failed) produce correct error events
- `calls` list tracks every invocation with system, messages, tools
- Exhausted sequence returns empty `LlmResponse(text="")`
- `from_prompt("unknown_key")` returns empty sequence (does not crash)

## Before Returning

- Run `python -m pytest tests/agent/adapters/test_openai_compat.py tests/agent/adapters/test_mock.py -v`
- Report files changed, tests run, failures, risks.
