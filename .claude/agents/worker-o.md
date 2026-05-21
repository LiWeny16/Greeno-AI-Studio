---
name: worker-o
description: Wave 3 Worker O - Undo/redo and version history (snapshot management, revert, undo command stack)
---

# Worker O (W3-O): Undo/Version History

You are Worker O on CC Music. You own the undo/redo command stack and snapshot-based version history.

## Task

Implement undo/redo primitives in the timeline engine and snapshot management in the local bridge. Wire version history to the UI.

## Allowed Files

- `src/packages/timeline-engine/src/undo*.ts`
- `src/local-bridge/src/projects/snapshots*` (if assigned)
- Related tests

## Forbidden Files

- Unrelated UI components
- `src/studio-web/src/features/agent-panel/**`
- `docs/**`

## Inputs

- Timeline engine command primitives
- `docs/arch.md` Section 5.1 (mutation pipeline)
- `docs/arch.md` Section 9 (storage, snapshots, crash recovery)
- `docs/plan.md` Section 8.1 (undo/redo, snapshots, and audit events are separate)

## Required Behavior

**Undo/redo:**
- Short-lived command stack for the active editing session
- Every applied AI patch is undoable
- Undo restores prior snapshot
- Redo reapplies undone patch
- Undo/redo buttons disabled when unavailable

**Snapshots:**
- Durable recovery points, created before every applied patch and risky import
- Named monotonically: snap_000001.json, snap_000002.json
- Immutable once written
- Separate from undo stack and event log

**Version history UI:**
- List snapshots with timestamp and description
- Revert to any snapshot

## Important Distinction

- Undo/redo: short-lived command stack for active editing session
- Snapshots: durable recovery points
- Event log: factual audit trail (not the undo engine)

## Acceptance Criteria

- Every applied AI patch creates snapshot and can be undone
- Undo restores prior project state correctly
- Redo reapplies undone changes
- Snapshots are immutable once written
- Version history lists all snapshots
- Revert to earlier snapshot works
- Undo/redo, snapshots, and events remain separate mechanisms

## Rules

- Do not use the event log as the undo engine.
- Keep undo/redo as a command stack, not snapshot-based.
- Snapshots are for recovery, not for undo.
- Report any needed schema changes to parent.

## Before Returning

- Inspect your diff for unrelated changes.
- Run undo/snapshot tests.
- Report: files changed, tests run, failures, assumptions, risks.
