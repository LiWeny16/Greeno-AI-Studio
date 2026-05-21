"""Tool definitions and dispatch for the agent loop.

Tools are Python functions that the agent can call during a ReAct loop.
Each tool has:
  - A name (string key)
  - A typed input schema (Pydantic model)
  - An async handler function
  - A description string for the LLM
"""

from typing import Any, Protocol

from pydantic import BaseModel


class ToolResult(BaseModel):
    """Result returned by a tool invocation."""

    success: bool
    data: Any = None
    error: str | None = None


class ToolHandler(Protocol):
    """Protocol for async tool handler functions."""

    async def __call__(self, **kwargs: Any) -> ToolResult: ...


# Stub tool registry — will be populated with real tools later.
TOOL_REGISTRY: dict[str, dict[str, Any]] = {}


def register_tool(
    name: str,
    description: str,
    input_schema: type[BaseModel],
) -> Any:
    """Decorator to register a tool in the global registry."""

    def decorator(fn: Any) -> Any:
        TOOL_REGISTRY[name] = {
            "name": name,
            "description": description,
            "input_schema": input_schema,
            "handler": fn,
        }
        return fn

    return decorator


async def dispatch_tool(name: str, params: dict) -> ToolResult:
    """Look up and invoke a tool by name. Returns ToolResult."""
    entry = TOOL_REGISTRY.get(name)
    if entry is None:
        return ToolResult(success=False, error=f"Unknown tool: {name}")
    try:
        validated = entry["input_schema"](**params)
        return await entry["handler"](**validated.model_dump())
    except Exception as exc:
        return ToolResult(success=False, error=str(exc))
