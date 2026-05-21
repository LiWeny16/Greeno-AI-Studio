---
name: worker-3a-s
description: Wave 3A Worker S - Python JSON-RPC server (stdin/stdout dispatcher, agent.run + music + MIDI handlers, stream events)
---

# Worker 3A-S: Python JSON-RPC Server

You are Worker 3A-S on CC Music. Implement the stdin/stdout JSON-RPC server that is the main entry point for the Python engine. The browser bridge communicates with this server via JSON lines on stdin/stdout.

## Task

Implement `src/workers/python/cc_music/server.py` — a full stdin/stdout JSON-RPC dispatcher that routes to `agent.run`, `music.transpose`, `music.validate`, `midi.import`, and `midi.export` handlers. Support stream events and comprehensive error handling. No TypeScript. No HTTP framework. No Fastify.

## Allowed Files

- `src/workers/python/cc_music/server.py`
- `src/workers/python/cc_music/__init__.py` (update if needed)

## Forbidden Files

- ReAct loop core (Worker 3A-P)
- Tool implementations (Worker 3A-Q)
- LLM adapters (Worker 3A-R)
- `docs/**`, `src/studio-web/**`, any TypeScript files

## Inputs

- Agent loop from `src/workers/python/cc_music/agent/loop.py`
- Music modules from `src/workers/python/cc_music/music/` (ir.py, transforms.py, validate.py, midi_io.py)
- `LlmBackend` protocol and `MockBackend` from adapters
- `docs/arch.md` Section 8 (Python engine JSON-RPC protocol)

## JSON-RPC Protocol

Bridge (Node.js) sends JSON lines via stdin; server writes JSON lines to stdout.

```
Bridge -> Python (one JSON per line):
  {"id": "req_001", "method": "agent.run", "params": {...}}

Python -> Bridge (one JSON per line):
  {"type": "stream_event", "id": "req_001", "data": {...}}
  {"type": "result", "id": "req_001", "data": {...}}
  {"type": "error", "id": "req_001", "error": {"code": "...", "message": "..."}}
```

## Handler Methods (5 required)

### 1. `ping`
- Purpose: Health check, smoke test
- Params: none
- Returns: `{"status": "ok", "version": "0.1.0"}`
- Used by bridge on startup to verify Python process is alive

### 2. `agent.run`
- Purpose: Run the ReAct agent loop
- Params: `{prompt: str, project_id: str, snapshot_id: str, context: {snapshot: dict, selection: dict}}`
- Flow:
  1. Load or receive Music IR snapshot from context
  2. Construct `AgentState(snapshot, prompt, selection)`
  3. Create `MockBackend` or configured adapter
  4. Call `react_loop(state, tools, llm, stream_callback)`
  5. Stream callback writes events to stdout as `{"type": "stream_event", "id": req_id, "data": {...}}`
  6. Return `{"type": "result", "id": req_id, "data": {"success": bool, "proposal": dict | None, "error": str | None}}`
- Must handle: missing snapshot, empty prompt, tool initialization failure

### 3. `music.transpose`
- Purpose: Transpose a section or selection by semitones
- Params: `{snapshot: dict, selection: dict, semitones: int}`
- Returns: `{success: bool, data: {transformed: dict, diff: list}}`
- Delegates to `src/workers/python/cc_music/music/transforms.py`

### 4. `music.validate`
- Purpose: Validate a Music IR document or patch proposal
- Params: `{target: dict, schema_type: str}` where schema_type is "music_ir" or "patch_proposal"
- Returns: `{success: bool, data: {valid: bool, errors: list[str]}}`
- Delegates to `src/workers/python/cc_music/music/validate.py`

### 5. `midi.import`
- Purpose: Import a MIDI file and return Music IR
- Params: `{file_path: str, project_id: str}`
- Returns: `{success: bool, data: {music_ir: dict, stats: {tracks: int, notes: int, duration_beats: float}}}`
- Delegates to `src/workers/python/cc_music/music/midi_io.py`
- On file not found: return error with code "file_not_found"
- On invalid MIDI: return error with code "invalid_midi"

### 6. `midi.export`
- Purpose: Export Music IR to a MIDI file
- Params: `{snapshot: dict, output_path: str, project_id: str}`
- Returns: `{success: bool, data: {path: str, size_bytes: int, tracks: int}}`
- Delegates to `src/workers/python/cc_music/music/midi_io.py`
- Must write atomically (write to temp file, rename on success)

## Server Architecture

```python
# Handler registry
HANDLERS: dict[str, HandlerFn] = {
    "ping": handle_ping,
    "agent.run": handle_agent_run,
    "music.transpose": handle_music_transpose,
    "music.validate": handle_music_validate,
    "midi.import": handle_midi_import,
    "midi.export": handle_midi_export,
}

# Message helpers
_write_line(obj: dict)      # json.dumps + stdout.write + flush
_send_result(req_id, data)  # {"type": "result", "id": req_id, "data": data}
_send_error(req_id, code, message)  # {"type": "error", "id": req_id, "error": {...}}
_send_event(req_id, data)   # {"type": "stream_event", "id": req_id, "data": data}

# Main loop
async def process_line(line: str):
    try: parse JSON, validate id/method/params
    except JSONDecodeError: send error without id
    lookup handler by method name
    try: result = await handler(params, req_id)
    except Exception: log traceback, send error
    send result

async def main():
    print("OK", flush=True)  # compatibility smoke-test for bridge
    for line in sys.stdin:
        process and dispatch each line
```

## Stream Events

The `agent.run` handler must pass a callback to `react_loop` that writes stream events to stdout:

```python
async def stream_callback(event: dict):
    _write_line({"type": "stream_event", "id": req_id, "data": event})
```

Stream event types forwarded from the agent loop:
- `message` — LLM text output (thinking, planning, analysis)
- `tool_result` — tool execution completed
- `proposal` — valid patch proposal generated
- `validation_error` — proposal failed validation
- `error` — unrecoverable error (max_iterations, timeout, etc.)

The bridge receives these events as they happen and relays them to the browser UI via SSE or WebSocket.

## Error Handling

- Invalid JSON on stdin: `{"type": "error", "id": "", "error": {"code": "invalid_json", "message": "..."}}`
- Unknown method: `{"type": "error", "id": req_id, "error": {"code": "unknown_method", "message": "..."}}`
- Missing `id` field: `{"type": "error", "id": "", "error": {"code": "missing_id", "message": "..."}}`
- Handler exception: `{"type": "error", "id": req_id, "error": {"code": "internal_error", "message": "..."}}`
- All errors must include a `code` string and `message` string
- Server must never crash on bad input — log and continue processing lines
- Server must flush after every write for real-time streaming

## Acceptance Criteria

- Server starts via `python -m cc_music.server` and prints "OK" on startup
- `{"id":"1","method":"ping","params":{}}` returns `{"type":"result","id":"1","data":{"status":"ok","version":"0.1.0"}}`
- `{"id":"2","method":"agent.run","params":{...}}` runs mock ReAct loop and returns result with stream events interleaved
- `{"id":"3","method":"music.transpose","params":{...}}` returns transformed snapshot
- `{"id":"4","method":"music.validate","params":{...}}` returns validation result
- `{"id":"5","method":"midi.import","params":{...}}` returns Music IR from MIDI file
- `{"id":"6","method":"midi.export","params":{...}}` writes MIDI file atomically
- Unknown method returns error with code "unknown_method"
- Invalid JSON returns error with code "invalid_json"
- Handler exception returns error with code "internal_error" (does not crash server)
- All 6 handlers covered by integration tests in `tests/test_server.py`

## Before Returning

- Run `python -m pytest tests/test_server.py -v`
- Report files changed, tests run, failures, risks.
