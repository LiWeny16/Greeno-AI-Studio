"""ReAct loop core — hand-written, no framework dependencies.

Pure Python implementation of the Reason + Act agent loop. No LangChain,
LangGraph, or any agent framework. The loop calls an LLM backend, dispatches
tools, validates proposals, and streams events — all in ~100 lines.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol


# ── Types ──

@dataclass
class AgentState:
    """Mutable agent state carried across loop iterations."""

    snapshot: dict  # Music IR snapshot
    user_prompt: str
    selection: dict  # {barRange?, sectionIds?, trackIds?}
    max_iterations: int = 10
    messages: list[dict] = field(default_factory=list)
    iteration: int = 0


@dataclass
class ToolCall:
    """A single tool invocation requested by the LLM."""

    id: str
    name: str
    arguments: dict


@dataclass
class LlmResponse:
    """Response from an LLM backend. At least one field should be populated."""

    text: str | None = None
    tool_calls: list[ToolCall] | None = None
    proposal: dict | None = None


class LlmBackend(Protocol):
    """Protocol for swappable LLM backends (mock, OpenAI-compat, Claude CLI, etc.)."""

    async def chat(self, system: str, messages: list[dict], tools: list[dict]) -> LlmResponse: ...


class Tool(Protocol):
    """Protocol for agent tools the LLM can call during a ReAct loop."""

    @property
    def name(self) -> str: ...

    @property
    def description(self) -> str: ...

    @property
    def parameters(self) -> dict:  # JSON Schema
        ...

    async def execute(self, args: dict, ctx: dict) -> dict: ...


# ── Helpers ──

def build_system_prompt(snapshot: dict, selection: dict) -> str:
    """Build the system prompt from the Music IR snapshot and user selection context."""
    section_count = len(snapshot.get("sections", []))
    track_count = len(snapshot.get("tracks", []))
    return (
        "You are a music composition assistant. You analyze Music IR snapshots "
        "and propose structured edits (patches). You cannot directly mutate "
        "project state. All changes must be proposed as JSON patches.\n\n"
        f"Current selection: {selection}\n"
        f"Snapshot summary: sections={section_count}, tracks={track_count}"
    )


def build_tool_schema(tool: Tool) -> dict:
    """Build an OpenAI-compatible tool definition dict from a Tool."""
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters,
        },
    }


def _find_tool(tools: list[Tool], name: str) -> Tool | None:
    """Find a tool by name in the tools list. Returns None if not found."""
    for t in tools:
        if t.name == name:
            return t
    return None


def validate_proposal(proposal: dict, snapshot: dict) -> list[str]:
    """Validate a patch proposal against basic structural rules.

    Returns a list of error strings (empty list = valid).
    The snapshot parameter is reserved for future context-aware validation
    (e.g. lock checks, section existence checks).
    """
    _ = snapshot  # reserved for context-aware validation
    errors: list[str] = []

    if not isinstance(proposal, dict):
        return ["proposal must be a dictionary"]

    if "patch" not in proposal:
        errors.append("proposal missing 'patch' field")
    else:
        patch = proposal["patch"]
        if not isinstance(patch, list):
            errors.append("proposal 'patch' must be a list of operations")
        else:
            valid_ops = {"add", "remove", "replace", "move", "copy", "test"}
            for i, op in enumerate(patch):
                if not isinstance(op, dict):
                    errors.append(f"patch operation {i} must be a dict")
                elif "op" not in op:
                    errors.append(f"patch operation {i} missing 'op' field")
                elif op.get("op") not in valid_ops:
                    errors.append(
                        f"patch operation {i} has invalid op: {op.get('op')}"
                    )

    if "musicalDiff" not in proposal:
        errors.append("proposal missing 'musicalDiff' field")

    return errors


# ── Core Loop ──

async def react_loop(
    state: AgentState,
    tools: list[Tool],
    llm: LlmBackend,
    on_event: Callable[[dict], Awaitable[None]],
) -> dict:
    """Run the hand-written ReAct loop.

    Returns: {"success": bool, "proposal": dict | None, "error": str | None}

    Pattern:
    1. Build system prompt from snapshot + selection
    2. Call LLM -> response
    3. If tool_calls -> execute tools -> append results -> loop
    4. If proposal -> validate -> return (or loop with validation errors)
    5. If text -> append message -> loop (continue thinking)
    6. Max iterations -> return error
    """
    system = build_system_prompt(state.snapshot, state.selection)

    while state.iteration < state.max_iterations:
        tool_schemas = [build_tool_schema(t) for t in tools]

        response = await llm.chat(
            system=system,
            messages=state.messages,
            tools=tool_schemas,
        )

        # Append any assistant text to message history and emit event
        if response.text:
            state.messages.append({"role": "assistant", "content": response.text})
            await on_event({"type": "message", "data": {"text": response.text}})

        # --- Branch: tool calls ---
        if response.tool_calls:
            for tc in response.tool_calls:
                tool = _find_tool(tools, tc.name)
                if tool is None:
                    result: dict = {"error": f"Unknown tool: {tc.name}"}
                else:
                    try:
                        result = await tool.execute(
                            tc.arguments, {"snapshot": state.snapshot}
                        )
                    except Exception as exc:
                        result = {"error": str(exc)}

                state.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tc.name,
                        "content": result,
                    }
                )
                await on_event(
                    {
                        "type": "tool_result",
                        "data": {
                            "tool_call_id": tc.id,
                            "name": tc.name,
                            "result": result,
                        },
                    }
                )

        # --- Branch: proposal ---
        elif response.proposal is not None:
            errors = validate_proposal(response.proposal, state.snapshot)
            if not errors:
                await on_event({"type": "proposal", "data": response.proposal})
                return {
                    "success": True,
                    "proposal": response.proposal,
                    "error": None,
                }
            else:
                # Feed validation errors back as user feedback for retry
                state.messages.append(
                    {
                        "role": "user",
                        "content": f"Validation errors in your proposal: {errors}",
                    }
                )
                await on_event(
                    {"type": "validation_error", "data": {"errors": errors}}
                )

        # --- Branch: text-only (continue thinking) ---
        # Already appended to messages above; just advance iteration.

        state.iteration += 1

    # Max iterations exhausted without a valid proposal
    await on_event(
        {
            "type": "error",
            "data": {"code": "max_iterations", "message": "Max iterations exceeded"},
        }
    )
    return {"success": False, "proposal": None, "error": "max_iterations_exceeded"}
