"""Tests for the hand-written ReAct loop core.

Tests cover: text-only responses, tool dispatch, proposal validation,
max iterations, empty tools, event streaming, and multiple mock sequences.
"""

from __future__ import annotations

from typing import Any

import pytest

from cc_music.agent.adapters.mock import MockBackend, _SAMPLE_PROPOSAL, _INVALID_PROPOSAL
from cc_music.agent.loop import (
    AgentState,
    LlmResponse,
    ToolCall,
    react_loop,
    validate_proposal,
)


# ── Test helpers ──

class _EventCollector:
    """Async callable that collects streaming events for assertions."""

    def __init__(self) -> None:
        self.events: list[dict] = []

    async def __call__(self, event: dict) -> None:
        self.events.append(event)


class MockTool:
    """Minimal Tool implementation for tests."""

    def __init__(
        self,
        name: str,
        description: str = "",
        parameters: dict | None = None,
        execute_result: dict | None = None,
    ) -> None:
        self._name = name
        self._description = description
        self._parameters = parameters or {
            "type": "object",
            "properties": {},
            "required": [],
        }
        self._execute_result = execute_result or {"status": "ok"}
        self.execute_calls: list[tuple[dict, dict]] = []

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    @property
    def parameters(self) -> dict:
        return self._parameters

    async def execute(self, args: dict, ctx: dict) -> dict:
        self.execute_calls.append((args, ctx))
        return self._execute_result


def _make_state(
    *,
    max_iterations: int = 10,
    snapshot: dict | None = None,
    selection: dict | None = None,
    user_prompt: str = "test prompt",
) -> AgentState:
    return AgentState(
        snapshot=snapshot or {"sections": [], "tracks": []},
        user_prompt=user_prompt,
        selection=selection or {},
        max_iterations=max_iterations,
    )


def _make_proposal(
    patch: list[dict] | None = None,
    musical_diff: dict | None = None,
) -> dict:
    return {
        "patch": patch or [
            {"op": "replace", "path": "/key", "value": "Am"},
        ],
        "musicalDiff": musical_diff or {
            "barsChanged": [1, 4],
            "notesAdded": 1,
            "notesRemoved": 0,
            "preservedMotifs": [],
        },
    }


# ── Tests: validate_proposal ──

class TestValidateProposal:
    def test_valid_proposal(self) -> None:
        proposal = _make_proposal()
        errors = validate_proposal(proposal, {})
        assert errors == []

    def test_missing_patch(self) -> None:
        proposal = {"musicalDiff": {}}
        errors = validate_proposal(proposal, {})
        assert any("missing 'patch'" in e for e in errors)

    def test_missing_musical_diff(self) -> None:
        proposal = {"patch": []}
        errors = validate_proposal(proposal, {})
        assert any("missing 'musicalDiff'" in e for e in errors)

    def test_patch_not_list(self) -> None:
        proposal = {"patch": "not a list", "musicalDiff": {}}
        errors = validate_proposal(proposal, {})
        assert any("must be a list" in e for e in errors)

    def test_patch_op_not_dict(self) -> None:
        proposal = {"patch": ["not a dict"], "musicalDiff": {}}
        errors = validate_proposal(proposal, {})
        assert any("must be a dict" in e for e in errors)

    def test_patch_op_missing_op_field(self) -> None:
        proposal = {"patch": [{"path": "/x"}], "musicalDiff": {}}
        errors = validate_proposal(proposal, {})
        assert any("missing 'op'" in e for e in errors)

    def test_patch_op_invalid_op(self) -> None:
        proposal = {"patch": [{"op": "invalid_op", "path": "/x"}], "musicalDiff": {}}
        errors = validate_proposal(proposal, {})
        assert any("invalid op" in e for e in errors)

    def test_not_dict_returns_error(self) -> None:
        errors = validate_proposal("not a dict", {})  # type: ignore[arg-type]
        assert errors == ["proposal must be a dictionary"]


# ── Tests: react_loop ──

class TestReactLoopTextOnly:
    """Mock backend returns text -> loop continues thinking."""

    async def test_text_response_appends_message_and_continues(self) -> None:
        """Text-only LLM responses are appended to messages and loop continues."""
        backend = MockBackend(
            responses=[
                LlmResponse(text="Looking at the project..."),
                LlmResponse(text="Analyzing structure..."),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state(max_iterations=10)

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        assert result["proposal"] is not None
        # Both text events and final proposal should have been emitted
        text_events = [e for e in collector.events if e["type"] == "message"]
        assert len(text_events) == 2
        assert "Looking at the project" in text_events[0]["data"]["text"]


class TestReactLoopToolDispatch:
    """Mock backend returns tool_call -> loop dispatches tool -> continues."""

    async def test_tool_call_dispatches_and_appends_result(self) -> None:
        """Tool calls are dispatched and their results appended to messages."""
        tool = MockTool(
            name="analyze_motif",
            description="Analyze a motif",
            execute_result={"motifId": "motif_main", "energy": 0.35},
        )
        backend = MockBackend(
            responses=[
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t1",
                            name="analyze_motif",
                            arguments={"motifId": "motif_main"},
                        )
                    ]
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [tool], backend, collector)

        assert result["success"] is True
        # Tool should have been called with correct args
        assert len(tool.execute_calls) == 1
        call_args, call_ctx = tool.execute_calls[0]
        assert call_args == {"motifId": "motif_main"}
        assert "snapshot" in call_ctx
        # Tool result event emitted
        tool_events = [e for e in collector.events if e["type"] == "tool_result"]
        assert len(tool_events) == 1
        assert tool_events[0]["data"]["name"] == "analyze_motif"
        # Tool result appended to messages
        tool_msgs = [m for m in state.messages if m["role"] == "tool"]
        assert len(tool_msgs) == 1
        assert tool_msgs[0]["name"] == "analyze_motif"

    async def test_multiple_tool_calls_in_one_response(self) -> None:
        """Multiple tool_calls in a single LLM response are all dispatched."""
        tool_a = MockTool(name="read_section", execute_result={"notes": 16})
        tool_b = MockTool(name="analyze_chords", execute_result={"chords": ["Am", "F"]})
        backend = MockBackend(
            responses=[
                LlmResponse(
                    tool_calls=[
                        ToolCall(id="t1", name="read_section", arguments={"bar": 1}),
                        ToolCall(id="t2", name="analyze_chords", arguments={"bar": 1}),
                    ]
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [tool_a, tool_b], backend, collector)

        assert result["success"] is True
        assert len(tool_a.execute_calls) == 1
        assert len(tool_b.execute_calls) == 1

    async def test_unknown_tool_returns_error_result(self) -> None:
        """Calling an unknown tool appends an error result but does not crash."""
        backend = MockBackend(
            responses=[
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t1", name="nonexistent", arguments={}
                        )
                    ]
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        tool_msgs = [m for m in state.messages if m["role"] == "tool"]
        assert len(tool_msgs) == 1
        assert "Unknown tool" in str(tool_msgs[0]["content"])

    async def test_tool_execute_exception_is_caught(self) -> None:
        """Tool execution errors are caught and returned as error results."""

        class _FailingTool(MockTool):
            async def execute(self, args: dict, ctx: dict) -> dict:
                self.execute_calls.append((args, ctx))
                raise RuntimeError("simulated failure")

        tool = _FailingTool(name="crashy")
        backend = MockBackend(
            responses=[
                LlmResponse(
                    tool_calls=[
                        ToolCall(id="t1", name="crashy", arguments={})
                    ]
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [tool], backend, collector)

        assert result["success"] is True
        tool_msgs = [m for m in state.messages if m["role"] == "tool"]
        assert "simulated failure" in str(tool_msgs[0]["content"])


class TestReactLoopProposal:
    """Mock backend returns proposal -> loop validates and returns."""

    async def test_valid_proposal_returns_success(self) -> None:
        """A valid proposal passes validation and the loop returns success."""
        proposal = _make_proposal()
        backend = MockBackend(responses=[LlmResponse(proposal=proposal)])
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        assert result["proposal"] == proposal
        assert result["error"] is None

    async def test_invalid_proposal_triggers_retry(self) -> None:
        """An invalid proposal feeds errors back and retries."""
        invalid = _INVALID_PROPOSAL  # missing "patch"
        valid = _make_proposal()
        backend = MockBackend(
            responses=[
                LlmResponse(proposal=invalid),
                LlmResponse(proposal=valid),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        assert result["proposal"] == valid
        # Validation error should have been emitted
        val_errors = [e for e in collector.events if e["type"] == "validation_error"]
        assert len(val_errors) == 1

    async def test_proposal_event_emitted_before_return(self) -> None:
        """The proposal event is emitted before the function returns."""
        proposal = _make_proposal()
        backend = MockBackend(responses=[LlmResponse(proposal=proposal)])
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        proposal_events = [e for e in collector.events if e["type"] == "proposal"]
        assert len(proposal_events) == 1
        assert proposal_events[0]["data"] == proposal


class TestReactLoopMaxIterations:
    """Max iterations hit -> returns error."""

    async def test_max_iterations_exceeded_returns_error(self) -> None:
        """When the LLM never produces a proposal, the loop errors out."""
        backend = MockBackend(
            responses=[LlmResponse(text="thinking...")] * 20
        )
        collector = _EventCollector()
        state = _make_state(max_iterations=3)

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is False
        assert result["proposal"] is None
        assert result["error"] == "max_iterations_exceeded"
        # Error event emitted
        error_events = [e for e in collector.events if e["type"] == "error"]
        assert len(error_events) == 1

    async def test_exact_max_iterations_boundary(self) -> None:
        """Proposal on the last allowed iteration still succeeds."""
        proposal = _make_proposal()
        # 3 text responses then a proposal — all fit within max_iterations=4.
        # The proposal is returned on the 4th pass (iteration=3) before the
        # bottom-of-loop increment, so iteration stays at 3.
        backend = MockBackend(
            responses=[
                LlmResponse(text="step 1"),
                LlmResponse(text="step 2"),
                LlmResponse(text="step 3"),
                LlmResponse(proposal=proposal),
            ]
        )
        collector = _EventCollector()
        state = _make_state(max_iterations=4)

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        assert state.iteration == 3


class TestReactLoopEmptyTools:
    """Empty tools list -> LLM never gets tool_calls."""

    async def test_empty_tools_sends_empty_schema_list(self) -> None:
        """When tools=[], the LLM receives an empty tools list."""
        backend = MockBackend(
            responses=[LlmResponse(proposal=_make_proposal())]
        )
        collector = _EventCollector()
        state = _make_state()

        await react_loop(state, [], backend, collector)

        # Verify empty tools array was passed to the LLM
        assert len(backend.calls) > 0
        assert backend.calls[0]["tools"] == []


class TestReactLoopEventStreaming:
    """Custom on_event receives all events."""

    async def test_on_event_receives_all_event_types(self) -> None:
        """The on_event callback receives message, tool_result, and proposal events."""
        tool = MockTool(name="read_ir", execute_result={"data": "ok"})
        backend = MockBackend(
            responses=[
                LlmResponse(text="Starting analysis..."),
                LlmResponse(
                    tool_calls=[
                        ToolCall(id="t1", name="read_ir", arguments={"bar": 1})
                    ]
                ),
                LlmResponse(text="Building patch..."),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [tool], backend, collector)

        assert result["success"] is True
        event_types = {e["type"] for e in collector.events}
        assert "message" in event_types
        assert "tool_result" in event_types
        assert "proposal" in event_types

    async def test_on_event_receives_text_content(self) -> None:
        """on_event receives the exact text from each LlmResponse."""
        backend = MockBackend(
            responses=[
                LlmResponse(text="Hello, world!"),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        await react_loop(state, [], backend, collector)

        text_events = [e for e in collector.events if e["type"] == "message"]
        assert len(text_events) == 1
        assert text_events[0]["data"]["text"] == "Hello, world!"

    async def test_on_event_not_called_after_max_iterations_error(self) -> None:
        """The error event is the last event emitted on failure."""
        backend = MockBackend(
            responses=[LlmResponse(text="x")] * 10
        )
        collector = _EventCollector()
        state = _make_state(max_iterations=2)

        await react_loop(state, [], backend, collector)

        # Last event should be the error
        assert collector.events[-1]["type"] == "error"
        assert collector.events[-1]["data"]["code"] == "max_iterations"


class TestMultipleSequences:
    """3 different mock tool call sequences."""

    async def test_sequence_1_read_then_patch(self) -> None:
        """Sequence: read section -> analyze -> generate -> proposal."""
        tool_read = MockTool(name="read_ir_section", execute_result={"notes": []})
        tool_analyze = MockTool(
            name="analyze_motif",
            execute_result={"contour": "ascending", "density": 0.5},
        )
        tool_generate = MockTool(
            name="generate_motif_variation",
            execute_result={"variationId": "var_1"},
        )

        backend = MockBackend(
            responses=[
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t1",
                            name="read_ir_section",
                            arguments={"barRange": [9, 16]},
                        )
                    ]
                ),
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t2",
                            name="analyze_motif",
                            arguments={"motifId": "motif_main"},
                        )
                    ]
                ),
                LlmResponse(text="Generating variation..."),
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t3",
                            name="generate_motif_variation",
                            arguments={"motifId": "motif_main", "transform": "invert"},
                        )
                    ]
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(
            state, [tool_read, tool_analyze, tool_generate], backend, collector
        )

        assert result["success"] is True
        assert len(tool_read.execute_calls) == 1
        assert len(tool_analyze.execute_calls) == 1
        assert len(tool_generate.execute_calls) == 1
        tool_results = [e for e in collector.events if e["type"] == "tool_result"]
        assert len(tool_results) == 3

    async def test_sequence_2_bassline_and_drums(self) -> None:
        """Sequence: generate bassline -> generate drums -> proposal."""
        tool_bass = MockTool(
            name="generate_bassline",
            execute_result={"basslineId": "bass_01", "notes": 8},
        )
        tool_drums = MockTool(
            name="generate_drum_pattern",
            execute_result={"patternId": "drums_01", "hits": 32},
        )

        backend = MockBackend(
            responses=[
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t1",
                            name="generate_bassline",
                            arguments={"chords": ["Am", "F", "C", "G"]},
                        )
                    ]
                ),
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t2",
                            name="generate_drum_pattern",
                            arguments={"style": "dark", "bpm": 120},
                        )
                    ]
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(
            state, [tool_bass, tool_drums], backend, collector
        )

        assert result["success"] is True
        assert tool_bass.execute_calls[0][0]["chords"] == ["Am", "F", "C", "G"]
        assert tool_drums.execute_calls[0][0]["style"] == "dark"

    async def test_sequence_3_interleaved_text_and_tools(self) -> None:
        """Sequence: text -> tool -> text -> tool -> text -> proposal."""
        tool_check = MockTool(
            name="check_lock_violations",
            execute_result={"violations": []},
        )
        tool_validate = MockTool(
            name="validate_patch_schema",
            execute_result={"valid": True},
        )

        backend = MockBackend(
            responses=[
                LlmResponse(text="Checking current state..."),
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t1",
                            name="check_lock_violations",
                            arguments={"sectionIds": ["sec_1"]},
                        )
                    ]
                ),
                LlmResponse(text="No violations found. Validating schema..."),
                LlmResponse(
                    tool_calls=[
                        ToolCall(
                            id="t2",
                            name="validate_patch_schema",
                            arguments={"proposal": {}},
                        )
                    ]
                ),
                LlmResponse(text="Schema looks good. Finalizing..."),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(
            state, [tool_check, tool_validate], backend, collector
        )

        assert result["success"] is True
        # 3 text messages, 2 tool results, 1 proposal
        text_events = [e for e in collector.events if e["type"] == "message"]
        tool_results = [e for e in collector.events if e["type"] == "tool_result"]
        proposal_events = [e for e in collector.events if e["type"] == "proposal"]
        assert len(text_events) == 3
        assert len(tool_results) == 2
        assert len(proposal_events) == 1


class TestPromptBasedMock:
    """Tests using MockBackend.from_prompt with PROMPTS keys."""

    async def test_make_bars_darker_prompt(self) -> None:
        """Full sequence for 'make bars 9-16 darker' ends with a valid proposal."""
        tool_analyze = MockTool(
            name="analyze_motif",
            execute_result={"motifId": "motif_main", "energy": 0.35},
        )
        tool_bassline = MockTool(
            name="generate_bassline",
            execute_result={"basslineId": "bass_01"},
        )

        backend = MockBackend.from_prompt("make bars 9-16 darker")
        collector = _EventCollector()
        state = _make_state(user_prompt="make bars 9-16 darker")

        result = await react_loop(
            state, [tool_analyze, tool_bassline], backend, collector
        )

        assert result["success"] is True
        assert result["proposal"] is not None
        assert "patch" in result["proposal"]
        assert "musicalDiff" in result["proposal"]
        # Tools were called
        assert len(tool_analyze.execute_calls) == 1
        assert len(tool_bassline.execute_calls) == 1
        # Events include messages and proposal
        assert any(e["type"] == "proposal" for e in collector.events)

    async def test_schema_invalid_prompt_retries(self) -> None:
        """'fail:schema_invalid' produces invalid proposal, then retries with valid."""
        backend = MockBackend.from_prompt("fail:schema_invalid")
        collector = _EventCollector()
        state = _make_state(max_iterations=10)

        result = await react_loop(state, [], backend, collector)

        # Should succeed on retry with the valid proposal
        assert result["success"] is True
        assert result["proposal"] is not None
        assert "patch" in result["proposal"]
        # Should have validation error events from the first attempt
        assert any(e["type"] == "validation_error" for e in collector.events)

    async def test_timeout_prompt_hits_max_iterations(self) -> None:
        """'fail:timeout' never produces a proposal, hits max_iterations."""
        backend = MockBackend.from_prompt("fail:timeout")
        collector = _EventCollector()
        state = _make_state(max_iterations=3)

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is False
        assert result["error"] == "max_iterations_exceeded"


class TestEdgeCases:
    """Edge case and robustness tests."""

    async def test_text_and_tool_calls_in_same_response(self) -> None:
        """LLM response with both text and tool_calls: both are processed."""
        tool = MockTool(name="analyze", execute_result={"ok": True})
        backend = MockBackend(
            responses=[
                LlmResponse(
                    text="I'll analyze the motif.",
                    tool_calls=[
                        ToolCall(id="t1", name="analyze", arguments={})
                    ],
                ),
                LlmResponse(proposal=_make_proposal()),
            ]
        )
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [tool], backend, collector)

        assert result["success"] is True
        # Both text and tool_result events emitted in same iteration
        assert any(e["type"] == "message" for e in collector.events)
        assert any(e["type"] == "tool_result" for e in collector.events)

    async def test_single_iteration_success(self) -> None:
        """Proposal on the very first iteration (iteration=0).

        The loop returns immediately from the proposal branch, before the
        bottom-of-loop increment, so iteration stays at 0.
        """
        proposal = _make_proposal()
        backend = MockBackend(responses=[LlmResponse(proposal=proposal)])
        collector = _EventCollector()
        state = _make_state()

        result = await react_loop(state, [], backend, collector)

        assert result["success"] is True
        assert state.iteration == 0

    async def test_iteration_counter_increments(self) -> None:
        """State.iteration increments after each text-only pass.

        The proposal return happens before the bottom-of-loop increment,
        so the final count reflects only completed text/tool passes (3).
        """
        proposal = _make_proposal()
        backend = MockBackend(
            responses=[
                LlmResponse(text="msg 1"),
                LlmResponse(text="msg 2"),
                LlmResponse(text="msg 3"),
                LlmResponse(proposal=proposal),
            ]
        )
        collector = _EventCollector()
        state = _make_state(max_iterations=10)

        await react_loop(state, [], backend, collector)

        assert state.iteration == 3

    async def test_responses_exhausted_returns_empty_response(self) -> None:
        """When mock sequence is exhausted, it returns empty LlmResponse (no-op)."""
        backend = MockBackend(responses=[])  # empty
        collector = _EventCollector()
        state = _make_state(max_iterations=2)

        result = await react_loop(state, [], backend, collector)

        # No text, no tool_calls, no proposal -> nothing happens each iteration
        # Falls through and hits max_iterations
        assert result["success"] is False
        assert result["error"] == "max_iterations_exceeded"
