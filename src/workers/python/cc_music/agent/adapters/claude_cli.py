"""Claude CLI adapter using local `claude` subprocess.

Spawns the `claude` CLI tool with --print --output-format stream-json and
parses the streaming JSON output into an LlmResponse.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from cc_music.agent.loop import LlmResponse, ToolCall


class ClaudeCliBackend:
    """Calls Claude via local `claude` CLI subprocess."""

    def __init__(self, model: str | None = None) -> None:
        """Create a Claude CLI backend.

        Args:
            model: Claude model to use (e.g. "claude-sonnet-4-20250514").
                   Defaults to the CLI's configured default when None.
        """
        self.model: str | None = model

    async def chat(
        self, system: str, messages: list[dict], tools: list[dict]
    ) -> LlmResponse:
        """Spawn claude CLI with --print and parse streaming JSON output.

        Builds args: claude --print --output-format stream-json [--model ...]
        Sends system prompt, messages, and tool definitions via stdin.
        Parses the stream-json output into an LlmResponse.

        All subprocess and parsing errors are caught and returned as text
        responses so the agent loop can handle them gracefully.
        """
        args = ["claude", "--print", "--output-format", "stream-json"]
        if self.model:
            args.extend(["--model", self.model])

        # Build the full message list with system prompt
        claude_messages: list[dict] = []
        if system:
            claude_messages.append({"role": "system", "content": system})
        claude_messages.extend(messages)

        stdin_data: dict[str, Any] = {"messages": claude_messages}
        if tools:
            stdin_data["tools"] = self._convert_tools(tools)

        stdin_bytes = json.dumps(stdin_data).encode("utf-8")

        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(stdin_bytes), timeout=180.0
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return LlmResponse(text="Claude CLI timed out after 180s.")

            if proc.returncode != 0:
                err_text = stderr.decode("utf-8", errors="replace")[:500]
                return LlmResponse(
                    text=f"Claude CLI error (code {proc.returncode}): {err_text}"
                )

            return self._parse_stream(stdout.decode("utf-8", errors="replace"))

        except FileNotFoundError:
            return LlmResponse(
                text="Claude CLI not found. Please install the `claude` CLI tool."
            )
        except Exception as exc:
            return LlmResponse(text=f"Claude CLI error: {exc}")

    @staticmethod
    def _convert_tools(tools: list[dict]) -> list[dict]:
        """Convert OpenAI-format tool schemas to Claude CLI tool format.

        OpenAI format:
          {"type": "function", "function": {"name": "...", "description": "...",
           "parameters": {...}}}

        Claude CLI format:
          {"name": "...", "description": "...", "input_schema": {...}}
        """
        result: list[dict] = []
        for tool in tools:
            fn = tool.get("function", {})
            result.append(
                {
                    "name": fn.get("name", ""),
                    "description": fn.get("description", ""),
                    "input_schema": fn.get("parameters", {}),
                }
            )
        return result

    @staticmethod
    def _parse_stream(output: str) -> LlmResponse:
        """Parse Claude's stream-json output into an LlmResponse.

        Handles two output patterns:
          1. Streaming deltas (content_block_start/delta/stop -> message)
             These accumulate text and tool_use inputs across events.
          2. Final message event with complete content blocks
             The final message may contain the full text and tool_use inputs.

        Returns LlmResponse with tool_calls if present, otherwise text or proposal.
        """
        text_parts: list[str] = []
        # Map of tool_use index -> ToolCall being accumulated from deltas
        pending_tools: dict[int, dict[str, Any]] = {}
        final_tool_calls: list[ToolCall] = []

        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event: dict = json.loads(line)
            except json.JSONDecodeError:
                continue

            event_type = event.get("type", "")

            if event_type == "content_block_start":
                block = event.get("content_block", {})
                if block.get("type") == "tool_use":
                    idx = block.get("index", len(pending_tools))
                    name = block.get("name", "")
                    tc_id = block.get("id", "")
                    pending_tools[idx] = {
                        "id": tc_id,
                        "name": name,
                        "arguments_json": "",
                    }

            elif event_type == "content_block_delta":
                delta = event.get("delta", {})
                delta_type = delta.get("type", "")
                if delta_type == "text_delta":
                    text_parts.append(delta.get("text", ""))
                elif delta_type == "input_json_delta":
                    idx = event.get("index", 0)
                    partial = delta.get("partial_json", "")
                    if idx in pending_tools:
                        pending_tools[idx]["arguments_json"] += partial

            elif event_type == "content_block_stop":
                idx = event.get("index", -1)
                if idx in pending_tools:
                    tool_data = pending_tools.pop(idx)
                    try:
                        arguments = json.loads(tool_data["arguments_json"])
                    except json.JSONDecodeError:
                        arguments = {}
                    final_tool_calls.append(
                        ToolCall(
                            id=tool_data["id"],
                            name=tool_data["name"],
                            arguments=arguments,
                        )
                    )

            elif event_type == "message":
                # Final message — may contain complete content blocks
                content = event.get("content", [])
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text = block.get("text", "")
                            if text and text not in "".join(text_parts):
                                text_parts.append(text)
                        elif block.get("type") == "tool_use":
                            tc = ToolCall(
                                id=block.get("id", ""),
                                name=block.get("name", ""),
                                arguments=block.get("input", {}),
                            )
                            # Avoid duplicates already captured from deltas
                            existing_ids = {t.id for t in final_tool_calls}
                            if tc.id not in existing_ids:
                                final_tool_calls.append(tc)

        # Drain any remaining pending tools
        for tool_data in pending_tools.values():
            try:
                arguments = json.loads(tool_data["arguments_json"])
            except json.JSONDecodeError:
                arguments = {}
            final_tool_calls.append(
                ToolCall(
                    id=tool_data["id"],
                    name=tool_data["name"],
                    arguments=arguments,
                )
            )

        combined_text = "".join(text_parts).strip()

        if final_tool_calls:
            return LlmResponse(
                tool_calls=final_tool_calls,
                text=combined_text or None,
            )

        # Attempt to interpret combined text as a JSON proposal
        if combined_text:
            try:
                parsed = json.loads(combined_text)
                if isinstance(parsed, dict) and "patch" in parsed:
                    return LlmResponse(proposal=parsed)
            except json.JSONDecodeError:
                pass
            return LlmResponse(text=combined_text)

        return LlmResponse(text="")
