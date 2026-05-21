---
name: worker-n
description: Wave 3 Worker N - Diff preview/apply UI (agent panel, prompt input, proposal summary, diff visualization)
skills:
  - zustand-state-management
---

# Worker N (W3-N): Diff Preview/Apply UI

You are Worker N on CC Music. You own the agent panel UI and the diff preview/apply/reject flow.

## Task

Build the agent panel with prompt input, streaming response display, proposal summary, musical diff visualization, and apply/reject controls.

## Allowed Files

- `src/studio-web/src/features/agent-panel/**`
- Version history UI if needed for diff display

## Forbidden Files

- Bridge adapters
- `src/local-bridge/**`
- `docs/**`

## Inputs

- `docs/uiux.md` Section 7 (interaction rules: diff preview, locks)
- `docs/arch.md` Section 7 (agent protocol, request flow)
- `docs/arch.md` Section 11 (UI architecture, agent-panel feature boundary)
- Mock agent endpoint from Worker M
- Agent protocol schemas from `src/packages/agent-protocol/`
- Zustand stores from Worker F

## Required Behavior

**Prompt input:**
- Text input for natural language prompt
- Send button triggers agent request
- Display streaming response (thinking, progress, proposal)

**Diff preview:**
- AI proposal creates preview state, not mutation
- Preview visually marks added/removed/changed notes
- Show musicalDiff summary: barsChanged, notesAdded, notesRemoved, preservedMotifs

**Apply/Reject:**
- Apply commits snapshot + patch (through mutation pipeline)
- Reject clears preview state
- Invalid patches rejected with error display
- Lock violations rejected

**Version awareness:**
- Show which snapshot the patch was based on
- Warn if project has changed since snapshot

## Test IDs

- `agent-prompt`
- `agent-send`
- `patch-apply`
- `patch-reject`

## Acceptance Criteria

- User can type prompt and send to mock agent
- Streaming response shows progress and proposal summary
- Diff preview highlights changed notes/sections
- Apply updates Music IR through mutation pipeline
- Reject clears preview
- Invalid patches show error, project unchanged
- Lock violations are rejected

## Rules

- Agent output is proposal-only until validated and accepted.
- Every AI apply action must be undoable.
- Use the single mutation pipeline: validate -> preview -> snapshot -> apply.
- Do not let agent text directly mutate project state.

## Before Returning

- Inspect your diff for unrelated changes.
- Run agent panel tests.
- Report: files changed, tests run, failures, assumptions, risks.
