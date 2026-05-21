"""stdin/stdout JSON-RPC server — main entry point for the Python engine.

Reads JSON lines from stdin, routes to handler methods, and writes
JSON lines to stdout.  Supports streaming events, results, and errors.

Handlers:
  ping              — health check, returns {"pong": true}
  agent.run         — run the ReAct agent loop with MockBackend, stream events
  music.transpose   — transpose notes by semitones
  music.validate    — validate a Music IR dict
  midi.import       — parse a .mid file into Music IR
  midi.export       — write Music IR to a .mid file

Protocol:
  Bridge -> Python:
    {"id":"req_001","method":"agent.run","params":{...}}

  Python -> Bridge (one JSON per line):
    {"type":"stream_event","data":{...}}       (intermediate progress)
    {"type":"result","id":"req_001","data":{...}}   (final success)
    {"type":"error","id":"req_001","error":{...}}   (failure)
"""

from __future__ import annotations

import json
import sys
import logging
from typing import Any

from cc_music.agent.loop import AgentState, LlmBackend, Tool, react_loop
from cc_music.agent.adapters.mock import MockBackend
from cc_music.music.transforms import transpose_notes
from cc_music.music.validate import validate_music_ir, validate_patch_proposal
from cc_music.music.midi_io import import_midi, export_midi

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Inline mock tools for agent.run
# ---------------------------------------------------------------------------


class _MockTool:
    """Minimal Tool implementation for the server's agent loop.

    The MockBackend's PROMPTS reference tool names like 'analyze_motif',
    'generate_bassline', etc.  These stubs return canned results so the
    agent loop works end-to-end with mocked LLM responses.
    """

    def __init__(
        self,
        name: str,
        description: str = "",
        parameters: dict | None = None,
    ) -> None:
        self._name = name
        self._description = description or f"Mock tool: {name}"
        self._parameters = parameters or {
            "type": "object",
            "properties": {},
            "required": [],
        }

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
        _ = args, ctx
        return {"status": "ok", "tool": self._name}


# Tools referenced by the MockBackend prompt sequences.
_AGENT_TOOLS: list[Tool] = [
    _MockTool("analyze_motif", "Analyze a musical motif's pitch contour, rhythm, and density."),
    _MockTool("generate_bassline", "Generate a bassline following a chord progression."),
    _MockTool("read_ir_section", "Read Music IR for a bar range."),
    _MockTool("analyze_chords", "Identify chords and cadences in a section."),
    _MockTool("generate_motif_variation", "Generate a new motif variant."),
    _MockTool("generate_drum_pattern", "Generate a rhythm pattern for drum track."),
    _MockTool("check_lock_violations", "Check for section/note lock violations."),
    _MockTool("validate_patch_schema", "Validate a candidate patch against the schema."),
    _MockTool("read_section", "Read section data."),
    _MockTool("read_ir", "Read full IR snapshot."),
    _MockTool("analyze", "General analysis tool."),
]

# ---------------------------------------------------------------------------
# Handler implementations
# ---------------------------------------------------------------------------


async def handle_ping(params: dict) -> dict:
    """Health-check handler.  Returns {"pong": true}."""
    _ = params
    return {"pong": True}


async def handle_agent_run(params: dict, emit_stream: Any = None) -> dict:
    """Run the ReAct agent loop with a mock backend.

    Params:
      prompt   — str, passed to MockBackend.from_prompt() to select canned responses
      context  — dict with optional snapshot, selection, max_iterations

    Streams intermediate events as {"type":"stream_event","data":{...}} lines
    via *emit_stream* (defaults to the module-level _write_stream helper).
    Returns the final react_loop result dict.
    """
    if emit_stream is None:
        emit_stream = _write_stream

    prompt: str = params.get("prompt", "")
    context: dict = params.get("context", {})

    snapshot: dict = context.get("snapshot", {"sections": [], "tracks": []})
    selection: dict = context.get("selection", {})
    max_iterations: int = context.get("max_iterations", 10)

    # Build the state
    state = AgentState(
        snapshot=snapshot,
        user_prompt=prompt,
        selection=selection,
        max_iterations=max_iterations,
    )

    # Select mock backend from the prompt key
    backend: LlmBackend = MockBackend.from_prompt(prompt)

    # Event callback — wraps react_loop events into stream_event lines
    async def on_event(event: dict) -> None:
        emit_stream(event)

    # Run the loop
    result: dict = await react_loop(state, _AGENT_TOOLS, backend, on_event)

    return result


async def handle_transpose(params: dict) -> dict:
    """Transpose note pitches by *semitones*.

    Params:
      notes     — list of note dicts (each with "pitch" key)
      semitones — int, positive = up, negative = down

    Returns {"notes": [...transposed notes...]}.
    """
    notes: list = params.get("notes", [])
    semitones: int = params.get("semitones", 0)
    result_notes = transpose_notes(notes, semitones)
    return {"notes": result_notes}


async def handle_validate(params: dict) -> dict:
    """Validate a Music IR dict against the expected schema.

    Params:
      data — the Music IR dict to validate

    Returns {"valid": bool, "errors": [str, ...]}.
    """
    data: dict = params.get("data", {})
    is_valid, errors = validate_music_ir(data)
    return {"valid": is_valid, "errors": errors}


async def handle_midi_import(params: dict) -> dict:
    """Parse a .mid file and return Music IR data.

    Params:
      filepath — path to the .mid file

    Returns a dict with tempo, time_signature, and tracks.
    """
    filepath: str = params.get("filepath", "")
    return import_midi(filepath)


async def handle_midi_export(params: dict) -> dict:
    """Write Music IR data to a .mid file.

    Params:
      data     — Music IR dict (tracks, tempo, time_signature)
      filepath — destination .mid path

    Returns {"filepath": "<written path>"}.
    """
    data: dict = params.get("data", {})
    filepath: str = params.get("filepath", "")
    result_path = export_midi(data, filepath)
    return {"filepath": result_path}


# ---------------------------------------------------------------------------
# Handler registry
# ---------------------------------------------------------------------------

HANDLERS: dict[str, Any] = {
    "ping": handle_ping,
    "agent.run": handle_agent_run,
    "music.transpose": handle_transpose,
    "music.validate": handle_validate,
    "midi.import": handle_midi_import,
    "midi.export": handle_midi_export,
}

# ---------------------------------------------------------------------------
# Message helpers
# ---------------------------------------------------------------------------


def _write_line(obj: dict) -> None:
    """Write a single JSON line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj, default=str) + "\n")
    sys.stdout.flush()


def _write_stream(event: dict) -> None:
    """Emit a stream_event line to stdout."""
    _write_line({"type": "stream_event", "data": event})


def _send_result(req_id: str, data: Any) -> None:
    _write_line({"type": "result", "id": req_id, "data": data})


def _send_error(req_id: str, code: str, message: str = "") -> None:
    err: dict[str, Any] = {"code": code}
    if message:
        err["message"] = message
    _write_line({"type": "error", "id": req_id, "error": err})


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


async def process_line(line: str) -> None:
    """Parse one JSON line, dispatch to handler, write result/error.

    Streaming handlers (agent.run) emit intermediate stream_event lines
    during processing; the final result is emitted by this function after
    the handler returns.
    """
    # Parse
    try:
        request: dict = json.loads(line)
    except json.JSONDecodeError as exc:
        _send_error("", "invalid_json", f"Invalid JSON: {exc}")
        return

    req_id: str = request.get("id", "")
    method: str = request.get("method", "")
    params: dict = request.get("params", {})

    # Route
    handler = HANDLERS.get(method)
    if handler is None:
        _send_error(req_id, "unknown_method", f"Unknown method: {method}")
        return

    # Execute
    try:
        result = await handler(params)
    except Exception as exc:
        logger.exception("Handler %r failed", method)
        _send_error(req_id, "handler_error", str(exc))
        return

    _send_result(req_id, result)


async def main() -> None:
    """Read JSON lines from stdin forever and dispatch them."""
    print("OK", flush=True)  # compatibility smoke-test
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        await process_line(line)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
