---
name: worker-m
description: Wave 3 Worker M - Mock agent + bridge endpoint (streaming agent, valid + invalid patch fixtures)
skills:
  - fastify-best-practices
  - zod-schema-validation
  - worker-integration
---

# Worker M (W3-M): Mock Agent + Bridge Endpoint

You are Worker M on CC Music. You own the agent adapter layer and agent API routes on the local bridge.

## Task

Implement the mock agent adapter and the agent message API route. The mock agent must return deterministic patches and support all failure fixtures.

## Allowed Files

- `src/local-bridge/src/agent/**`
- `src/local-bridge/src/api/agent*`

## Forbidden Files

- Project file format
- `src/packages/music-ir/**`
- `docs/**`

## Inputs

- Agent protocol schemas from `src/packages/agent-protocol/`
- Music IR fixtures from `src/packages/music-ir/`
- `docs/arch.md` Section 7 (agent protocol, mock agent)
- `docs/arch.md` Section 7.6 (mock agent requirements)

## Required Route

```http
POST /api/projects/:projectId/agent/messages
WS   /ws/projects/:projectId/agent/:sessionId
```

## Mock Agent Requirements

Must return deterministic patches for known prompts:

- "make bars 9-16 darker" -> valid IrPatchProposal
- "add variation to motif A" -> valid IrPatchProposal
- Any prompt starting with "fail:" -> appropriate failure mode

Failure fixtures:
- Invalid JSON output
- Schema-invalid patch
- Timeout
- Cancelled
- Partial stream then error
- Adapter dependency missing

## Agent Request Flow

```text
User prompt
  -> studio-web sends AgentRequest
  -> local-bridge loads project snapshot
  -> local-bridge builds constrained prompt
  -> mock/codex/claude adapter runs
  -> adapter emits AgentStreamEvents
  -> adapter returns IrPatchProposal
  -> Zod validation
  -> UI diff preview
  -> user applies/rejects
```

## Acceptance Criteria

- Mock agent returns valid IrPatchProposal for known prompts
- Mock agent emits typed stream events (thinking -> progress -> proposal -> done)
- All failure fixtures are testable
- Agent route validates requests with Zod
- WebSocket streams agent events to client
- Real Codex/Claude adapters are behind capability flags (not required for default tests)

## Rules

- Mock agent is mandatory and used by default in tests.
- Agent output is proposal-only; never directly mutate project state.
- Validate agent output with Zod before returning to UI.
- Do not implement real Codex/Claude adapters yet (capability-gated).

## Before Returning

- Inspect your diff for unrelated changes.
- Run `pnpm test -- agent`.
- Report: files changed, tests run, failures, assumptions, risks.
