---
name: worker-3a-p
description: Wave 3A Worker P - LangGraph state machine definition (nodes, edges, AgentState, conditional routing)
---

# Worker 3A-P: LangGraph Graph Definition

You are Worker 3A-P on CC Music. You own the LangGraph state machine that orchestrates the ReAct agent loop.

## Task

Define the LangGraph state machine in TypeScript: AgentState type, graph nodes (ANALYZE, PLAN, TOOL_EXECUTE, OBSERVE, GENERATE_PATCH, SELF_VALIDATE, FINALIZE, FINALIZE_ERROR), edges, and conditional routing.

## Allowed Files

- `src/local-bridge/src/agent/graph.ts`
- `src/local-bridge/src/agent/state.ts`

## Forbidden Files

- Tool implementations (Worker 3A-Q, 3A-R)
- Real LLM adapters (Worker 3A-S does mock, real adapters later)
- `src/studio-web/**`, `docs/**`

## Inputs

- `docs/arch.md` Sections 7.4 (LangGraph ReAct Loop Architecture)
- Agent protocol schemas from `@cc-music/agent-protocol`
- Music IR schemas from `@cc-music/music-ir`

## AgentState Interface

```typescript
interface AgentState {
  projectSnapshot: MusicIr;
  userPrompt: string;
  selection: AgentSelection;
  messages: BaseMessage[];
  currentStep: string;
  iterationCount: number;
  analysis?: MusicAnalysis;
  plan?: EditPlan;
  intermediatePatch?: IrPatchProposal;
  finalProposal?: IrPatchProposal;
  error?: AgentError;
}
```

## Graph Structure

```
START → ANALYZE → PLAN → TOOL_EXECUTE → OBSERVE
            ↑                              │
            └────── need_more ─────────────┘
                       │ confident
                       ▼
            GENERATE_PATCH → SELF_VALIDATE
                       │            │
                  passes        fails → back to PLAN
                       │
                       ▼
                   FINALIZE → END
```

## Safety Enforcements

- maxIterations: 10 (return error on exceeded)
- Each node must emit appropriate AgentStreamEvent via callback
- TOOL_EXECUTE must validate tool outputs before passing to OBSERVE
- GENERATE_PATCH output must be parseable JSON

## Acceptance Criteria

- Graph compiles and can be instantiated
- Mock agent can traverse the graph end-to-end
- Safety limits trigger correctly (max iterations, timeout)
- Each node transition emits correct stream event type
- Graph tests pass

## Before Returning

- Run `pnpm typecheck && pnpm test`
- Report files changed, tests run, failures, risks.
