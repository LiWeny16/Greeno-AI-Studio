---
name: worker-3a-p
description: Wave 3A Worker P - Python ReAct agent loop core (AgentState dataclass, async react_loop, hand-written, no frameworks)
---

# Worker 3A-P: Python ReAct Loop Core

You are Worker 3A-P on CC Music. You own the hand-written ReAct agent loop in Python. No LangChain. No LangGraph. No TypeScript.

## Task

Implement `src/workers/python/cc_music/agent/loop.py` — the hand-written Reason + Act loop core (~200 lines of pure Python). This is the central orchestration engine that calls an LLM backend, dispatches tools, validates proposals, and streams events.

## Allowed Files

- `src/workers/python/cc_music/agent/loop.py`
- `src/workers/python/cc_music/agent/__init__.py` (update if needed)

## Forbidden Files

- Tool implementations (Worker 3A-Q)
- LLM adapter implementations (Worker 3A-R)
- JSON-RPC server (Worker 3A-S)
- `docs/**`, `src/studio-web/**`, any TypeScript files

## Inputs

- `docs/arch.md` Section 7 (agent protocol architecture)
- Music IR schemas from `src/workers/python/cc_music/music/ir.py`

## AgentState Dataclass

```python
@dataclass
class AgentState:
    snapshot: dict              # Music IR snapshot
    user_prompt: str            # Natural-language user instruction
    selection: dict             # {barRange?, sectionIds?, trackIds?}
    max_iterations: int = 10
    messages: list[dict] = field(default_factory=list)
    iteration: int = 0
```

## Core Types

- `ToolCall` dataclass: `{id, name, arguments}`
- `LlmResponse` dataclass: `{text?, tool_calls?, proposal?}` — at least one field populated
- `LlmBackend` Protocol: `async def chat(system, messages, tools) -> LlmResponse`
- `Tool` Protocol: `{name, description, parameters, async execute(args, ctx) -> dict}`

## React Loop Algorithm

```
async def react_loop(state: AgentState, tools: list[Tool], llm: LlmBackend,
                     on_event: Callable[[dict], Awaitable[None]]) -> dict:
    while state.iteration < state.max_iterations:
        1. Build tool schemas from Tool list
        2. Call llm.chat(system, messages, tool_schemas) -> response
        3. Append assistant text to messages, emit "message" event
        4. If response.tool_calls:
             - Find tool by name, execute with args + ctx
             - Append tool result to messages, emit "tool_result" event
             - Continue loop (LLM sees tool output and decides next step)
        5. If response.proposal:
             - validate_proposal() — check patch shape, op types, musicalDiff
             - If valid: emit "proposal" event, return success
             - If invalid: append validation errors as user feedback, emit "validation_error", loop
        6. If text-only: advance iteration, continue loop
    Emit "error" with code "max_iterations", return failure
```

## Safety Enforcements

- `max_iterations: 10` default — return error on exceeded
- Each loop branch must emit an appropriate stream event via `on_event` callback
- Tool execution errors must be caught, wrapped in `{"error": str}`, and fed back to LLM
- Proposal validation must check: is dict, has "patch" list, each op has valid "op" field (add/remove/replace/move/copy/test), has "musicalDiff"
- Never mutate canonical project state — only return proposals

## Helpers Required

- `build_system_prompt(snapshot, selection) -> str`: Construct system prompt from snapshot metadata + selection context
- `build_tool_schema(tool: Tool) -> dict`: Build OpenAI-compatible tool definition dict
- `validate_proposal(proposal, snapshot) -> list[str]`: Validate patch proposal structure; snapshot reserved for future lock checks

## Acceptance Criteria

- `AgentState` dataclass compiles and accepts defaults
- `react_loop` with mock backend traverses full loop: text -> tool_call -> tool_result -> proposal -> validate -> return
- Safety limits: max_iterations triggers correctly at iteration 10
- Each loop branch emits correct stream event type (message, tool_result, proposal, validation_error, error)
- Invalid proposals are fed back as user messages; LLM gets a retry
- Tool not found returns error result that does not crash the loop
- All unit tests pass with `python -m pytest tests/agent/test_loop.py -v`

## Before Returning

- Run `python -m pytest tests/agent/test_loop.py -v`
- Report files changed, tests run, failures, risks.
