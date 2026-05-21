---
name: worker-3a-s
description: Wave 3A Worker S - Mock ReAct agent adapter (deterministic tool outputs, full loop integration)
---

# Worker 3A-S: Mock ReAct Agent Adapter

You are Worker 3A-S on CC Music. Implement the mock agent adapter that exercises the full LangGraph ReAct loop with deterministic tool outputs.

## Task

Wire the LangGraph graph to a mock LLM backend that returns deterministic responses. The mock agent must exercise all graph nodes and support all failure modes.

## Allowed Files

- `src/local-bridge/src/agent/adapters/mock.ts`
- `src/local-bridge/src/api/agent-messages.ts` (new — POST route + WebSocket)
- `src/local-bridge/src/agent/index.ts` (agent factory)
- `src/local-bridge/src/server.ts` (register agent routes)

## Forbidden Files

- Real LLM backends (Claude/Codex adapters)
- `src/studio-web/**`

## Mock Agent Behavior

For known prompt patterns, return deterministic tool calls and stream events:

- `"make bars 9-16 darker"` → analyze section → plan style change → generate variation → validate → propose patch
- `"add bassline to section A"` → analyze chords → generate bassline → validate → propose patch
- `"vary motif_main"` → analyze motif → generate variation → validate → propose patch
- Any prompt starting with `"fail:"` → appropriate failure mode

## Stream Events

The mock agent must emit the full sequence:
```
started → message (analyzing) → message (planning) → message (generating) → message (validating) → proposal → completed
```

## Failure Fixtures

- `"fail:invalid_json"` → emit `failed` with code `invalid_json`
- `"fail:schema_invalid"` → emit proposal that fails Zod, then `failed` with code `schema_invalid`
- `"fail:timeout"` → delay beyond timeout, emit `failed` with code `timeout`
- `"fail:cancelled"` → emit `failed` with code `cancelled`
- `"fail:max_iterations"` → loop 11 times, emit `failed` with code `adapter_failed`

## API Integration

Agent message route:
```http
POST /api/projects/:projectId/agent/messages
  body: { prompt, selection, snapshotId }
  response: stream of AgentStreamEvent (SSE or NDJSON)
```

## Acceptance Criteria

- Mock agent traverses full ReAct graph for known prompts
- All stream event types emitted in correct sequence
- All 5 failure modes produce correct error events
- POST /api/projects/:projectId/agent/messages returns streaming response
- WebSocket route streams events if assigned
- Integration tests pass with `app.inject()`

## Before Returning

- Run `pnpm typecheck && pnpm test`
- Report files changed, tests run, failures, risks.
