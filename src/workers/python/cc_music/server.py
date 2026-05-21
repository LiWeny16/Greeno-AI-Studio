"""stdin/stdout JSON-RPC server — main entry point for the Python engine.

Reads JSON lines from stdin, routes to handler methods, and writes
JSON lines to stdout.  Supports streaming events, results, and errors.

Protocol:
  Bridge -> Python:
    {"id":"req_001","method":"agent.run","params":{...}}

  Python -> Bridge (one JSON per line):
    {"type":"stream_event","data":{...}}
    {"type":"result","id":"req_001","data":{...}}
    {"type":"error","id":"req_001","error":{...}}
"""

from __future__ import annotations

import json
import sys
import logging
from typing import Any

from cc_music.agent.loop import run_react_loop

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Handler registry
# ---------------------------------------------------------------------------

HandlerFn: type = Any  # simplified for the stub


async def handle_ping(params: dict) -> str:
    """Health-check handler."""
    _ = params
    return "pong"


async def handle_agent_run(params: dict) -> dict:
    """Run the ReAct agent loop."""
    prompt = params.get("prompt", "")
    context = params.get("context", {})
    return await run_react_loop(prompt, context)


HANDLERS: dict[str, HandlerFn] = {
    "ping": handle_ping,
    "agent.run": handle_agent_run,
}

# ---------------------------------------------------------------------------
# Message helpers
# ---------------------------------------------------------------------------


def _write_line(obj: dict) -> None:
    """Write a single JSON line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj, default=str) + "\n")
    sys.stdout.flush()


def _send_result(req_id: str, data: Any) -> None:
    _write_line({"type": "result", "id": req_id, "data": data})


def _send_error(req_id: str, error_msg: str) -> None:
    _write_line(
        {
            "type": "error",
            "id": req_id,
            "error": {"message": error_msg},
        }
    )


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


async def process_line(line: str) -> None:
    """Parse one JSON line, dispatch to handler, write result/error."""
    try:
        request: dict = json.loads(line)
    except json.JSONDecodeError as exc:
        _send_error("", f"Invalid JSON: {exc}")
        return

    req_id = request.get("id", "")
    method = request.get("method", "")
    params = request.get("params", {})

    handler = HANDLERS.get(method)
    if handler is None:
        _send_error(req_id, f"Unknown method: {method}")
        return

    try:
        result = await handler(params)
    except Exception as exc:
        logger.exception("Handler %r failed", method)
        _send_error(req_id, str(exc))
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
