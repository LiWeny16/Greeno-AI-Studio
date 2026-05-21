"""Tests for LLM adapters.

Tests cover: MockBackend (deterministic adapter), OpenAiCompatBackend
instantiation (no real HTTP), and ClaudeCliBackend instantiation (no real
subprocess).
"""

from __future__ import annotations

import pytest

from cc_music.agent.adapters.claude_cli import ClaudeCliBackend
from cc_music.agent.adapters.mock import MockBackend
from cc_music.agent.adapters.openai_compat import OpenAiCompatBackend
from cc_music.agent.loop import LlmResponse, ToolCall


# ── MockBackend tests ──


class TestMockBackendFromPrompt:
    """Tests for MockBackend.from_prompt() factory."""

    def test_returns_correct_sequence_for_make_bars_darker(self) -> None:
        """from_prompt('make bars 9-16 darker') returns 6 responses."""
        backend = MockBackend.from_prompt("make bars 9-16 darker")
        assert len(backend._responses) == 6

    def test_make_bars_darker_ends_with_proposal(self) -> None:
        """Last response in 'make bars 9-16 darker' is a valid proposal."""
        backend = MockBackend.from_prompt("make bars 9-16 darker")
        last = backend._responses[-1]
        assert last.proposal is not None
        assert "patch" in last.proposal
        assert "musicalDiff" in last.proposal

    def test_make_bars_darker_has_tool_calls_and_text(self) -> None:
        """Sequence mixes text, tool_calls, and proposal."""
        backend = MockBackend.from_prompt("make bars 9-16 darker")
        has_text = any(r.text is not None for r in backend._responses)
        has_tool = any(r.tool_calls is not None for r in backend._responses)
        has_proposal = any(r.proposal is not None for r in backend._responses)
        assert has_text
        assert has_tool
        assert has_proposal

    def test_fail_schema_invalid_includes_invalid_then_valid(self) -> None:
        """'fail:schema_invalid' has invalid proposal first, valid last."""
        backend = MockBackend.from_prompt("fail:schema_invalid")
        # Second response is the invalid proposal (missing "patch")
        assert backend._responses[1].proposal is not None
        assert "patch" not in backend._responses[1].proposal
        # Last response is the valid retry
        assert backend._responses[-1].proposal is not None
        assert "patch" in backend._responses[-1].proposal

    def test_fail_timeout_has_no_proposals(self) -> None:
        """'fail:timeout' sequence contains only text responses."""
        backend = MockBackend.from_prompt("fail:timeout")
        for r in backend._responses:
            assert r.proposal is None
        assert len(backend._responses) == 10

    def test_unknown_key_returns_empty_sequence(self) -> None:
        """Unknown prompt key yields an empty response list."""
        backend = MockBackend.from_prompt("nonexistent_key")
        assert len(backend._responses) == 0


class TestMockBackendChat:
    """Tests for MockBackend.chat() behaviour."""

    async def test_advances_through_sequence(self) -> None:
        """chat() returns responses in order, one per call."""
        responses = [
            LlmResponse(text="first"),
            LlmResponse(text="second"),
            LlmResponse(text="third"),
        ]
        backend = MockBackend(responses=responses)

        r1 = await backend.chat("sys", [], [])
        r2 = await backend.chat("sys", [], [])
        r3 = await backend.chat("sys", [], [])

        assert r1.text == "first"
        assert r2.text == "second"
        assert r3.text == "third"

    async def test_exhausted_sequence_returns_empty(self) -> None:
        """When sequence is exhausted, chat() returns empty LlmResponse."""
        backend = MockBackend(responses=[LlmResponse(text="only")])

        r1 = await backend.chat("", [], [])
        r2 = await backend.chat("", [], [])

        assert r1.text == "only"
        assert r2.text == ""

    async def test_empty_constructor_returns_empty_response(self) -> None:
        """MockBackend() with no arguments returns empty text."""
        backend = MockBackend()

        r = await backend.chat("", [], [])
        assert r.text == ""

    async def test_records_call_details(self) -> None:
        """chat() records system, messages, and tools for assertions."""
        backend = MockBackend(responses=[LlmResponse(text="ok")])

        await backend.chat(
            system="You are a musician.",
            messages=[{"role": "user", "content": "add bass"}],
            tools=[{"type": "function", "function": {"name": "analyze"}}],
        )

        assert len(backend.calls) == 1
        call = backend.calls[0]
        assert call["system"] == "You are a musician."
        assert call["messages"] == [{"role": "user", "content": "add bass"}]
        assert len(call["tools"]) == 1
        assert call["tools"][0]["function"]["name"] == "analyze"

    async def test_preserves_tool_calls(self) -> None:
        """chat() correctly returns LlmResponse with tool_calls."""
        responses = [
            LlmResponse(
                tool_calls=[
                    ToolCall(id="t1", name="analyze_motif", arguments={"bar": 1})
                ]
            )
        ]
        backend = MockBackend(responses=responses)

        r = await backend.chat("", [], [])

        assert r.tool_calls is not None
        assert len(r.tool_calls) == 1
        assert r.tool_calls[0].id == "t1"
        assert r.tool_calls[0].name == "analyze_motif"
        assert r.tool_calls[0].arguments == {"bar": 1}

    async def test_preserves_proposal(self) -> None:
        """chat() correctly returns LlmResponse with proposal."""
        proposal = {"patch": [], "musicalDiff": {"barsChanged": [1, 4]}}
        backend = MockBackend(
            responses=[LlmResponse(proposal=proposal)]
        )

        r = await backend.chat("", [], [])

        assert r.proposal == proposal

    async def test_multiple_calls_increment_index(self) -> None:
        """chat() increments internal index on each call."""
        backend = MockBackend(
            responses=[LlmResponse(text="a"), LlmResponse(text="b")]
        )

        await backend.chat("", [], [])
        assert backend._index == 1
        await backend.chat("", [], [])
        assert backend._index == 2
        await backend.chat("", [], [])
        assert backend._index == 2  # exhausted, does not go past length

    async def test_from_prompt_preserves_original(self) -> None:
        """from_prompt copies the sequence — changing a returned backend
        does not mutate the shared PROMPTS dict."""
        backend = MockBackend.from_prompt("make bars 9-16 darker")
        original_len = len(MockBackend.PROMPTS["make bars 9-16 darker"])

        # Mutate the returned instance
        backend._responses.append(LlmResponse(text="extra"))

        # Original PROMPTS entry should be unchanged
        assert len(MockBackend.PROMPTS["make bars 9-16 darker"]) == original_len


# ── OpenAiCompatBackend tests (no real HTTP) ──


class TestOpenAiCompatBackend:
    """Tests for OpenAiCompatBackend instantiation (no real HTTP calls)."""

    def test_can_instantiate_defaults(self) -> None:
        """Can create with default parameters."""
        backend = OpenAiCompatBackend()
        assert backend.base_url == "http://localhost:11434/v1"
        assert backend.model == "llama3"

    def test_can_instantiate_custom(self) -> None:
        """Can create with custom base_url and model."""
        backend = OpenAiCompatBackend(
            base_url="https://api.openai.com/v1",
            model="gpt-4o",
        )
        assert backend.base_url == "https://api.openai.com/v1"
        assert backend.model == "gpt-4o"

    def test_trailing_slash_stripped_from_base_url(self) -> None:
        """Trailing slash in base_url is stripped."""
        backend = OpenAiCompatBackend(
            base_url="http://localhost:11434/v1/"
        )
        assert backend.base_url == "http://localhost:11434/v1"

    def test_api_key_stored(self) -> None:
        """Custom api_key is stored."""
        backend = OpenAiCompatBackend(api_key="sk-test-key")
        assert backend.api_key == "sk-test-key"

    def test_close_does_not_raise_when_no_client(self) -> None:
        """close() is safe when no request was made."""
        import asyncio

        backend = OpenAiCompatBackend()
        # Should not raise — close is a no-op when no client was created
        asyncio.run(backend.close())

    def test_chat_has_correct_signature(self) -> None:
        """chat() is an async method accepting system, messages, tools."""
        backend = OpenAiCompatBackend()
        assert callable(backend.chat)
        import inspect
        sig = inspect.signature(backend.chat)
        params = list(sig.parameters.keys())
        assert "system" in params
        assert "messages" in params
        assert "tools" in params


# ── ClaudeCliBackend tests (no real subprocess) ──


class TestClaudeCliBackend:
    """Tests for ClaudeCliBackend instantiation (no real subprocess calls)."""

    def test_can_instantiate_defaults(self) -> None:
        """Can create with default parameters (model=None)."""
        backend = ClaudeCliBackend()
        assert backend.model is None

    def test_can_instantiate_custom_model(self) -> None:
        """Can create with a specific model name."""
        backend = ClaudeCliBackend(model="claude-opus-4-20250514")
        assert backend.model == "claude-opus-4-20250514"

    def test_chat_has_correct_signature(self) -> None:
        """chat() is an async method accepting system, messages, tools."""
        backend = ClaudeCliBackend()
        assert callable(backend.chat)
        import inspect
        sig = inspect.signature(backend.chat)
        params = list(sig.parameters.keys())
        assert "system" in params
        assert "messages" in params
        assert "tools" in params

    @staticmethod
    def test_convert_tools_transforms_format() -> None:
        """_convert_tools transforms OpenAI tool format to Claude CLI format."""
        openai_tools = [
            {
                "type": "function",
                "function": {
                    "name": "analyze_motif",
                    "description": "Analyze a musical motif",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "motifId": {"type": "string"},
                        },
                        "required": ["motifId"],
                    },
                },
            }
        ]
        result = ClaudeCliBackend._convert_tools(openai_tools)
        assert len(result) == 1
        assert result[0]["name"] == "analyze_motif"
        assert result[0]["description"] == "Analyze a musical motif"
        assert result[0]["input_schema"]["properties"]["motifId"]["type"] == "string"

    def test_parse_stream_empty_returns_empty_response(self) -> None:
        """Empty stream output returns empty LlmResponse."""
        result = ClaudeCliBackend._parse_stream("")
        assert result.text == ""
        assert result.tool_calls is None
        assert result.proposal is None

    def test_parse_stream_text_only(self) -> None:
        """Stream with plain text returns LlmResponse(text=...)."""
        output = (
            '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n'
            '{"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n'
        )
        result = ClaudeCliBackend._parse_stream(output)
        assert result.text == "Hello world"
        assert result.tool_calls is None
        assert result.proposal is None

    def test_parse_stream_json_proposal(self) -> None:
        """Stream containing JSON with 'patch' key returns LlmResponse(proposal=...)."""
        import json as _json

        proposal_json = '{"patch":[{"op":"replace","path":"/key","value":"Am"}],"musicalDiff":{"barsChanged":[1]}}'
        output = (
            f'{{"type":"content_block_delta","delta":{{"type":"text_delta","text":{_json.dumps(proposal_json)}}}}}\n'
        )
        result = ClaudeCliBackend._parse_stream(output)
        assert result.proposal is not None
        assert result.proposal["patch"][0]["op"] == "replace"

    def test_parse_stream_tool_use_from_deltas(self) -> None:
        """Stream with tool_use content blocks returns LlmResponse(tool_calls=...)."""
        output = (
            '{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t1","name":"analyze_motif"}}\n'
            '{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"motifId\\":\\"motif_main\\"}"}}\n'
            '{"type":"content_block_stop","index":0}\n'
        )
        result = ClaudeCliBackend._parse_stream(output)
        assert result.tool_calls is not None
        assert len(result.tool_calls) == 1
        assert result.tool_calls[0].id == "t1"
        assert result.tool_calls[0].name == "analyze_motif"
        assert result.tool_calls[0].arguments == {"motifId": "motif_main"}

    def test_parse_stream_tool_use_from_final_message(self) -> None:
        """Final message event with tool_use block returns LlmResponse(tool_calls=...)."""
        output = (
            '{"type":"message","content":['
            '{"type":"tool_use","id":"t2","name":"generate_bassline","input":{"chords":["Am","F"]}}'
            "]}\n"
        )
        result = ClaudeCliBackend._parse_stream(output)
        assert result.tool_calls is not None
        assert len(result.tool_calls) == 1
        assert result.tool_calls[0].name == "generate_bassline"
        assert result.tool_calls[0].arguments == {"chords": ["Am", "F"]}

    def test_parse_stream_malformed_json_skipped(self) -> None:
        """Malformed JSON lines are skipped without crashing."""
        output = (
            "not valid json\n"
            '{"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n'
        )
        result = ClaudeCliBackend._parse_stream(output)
        assert result.text == "ok"
