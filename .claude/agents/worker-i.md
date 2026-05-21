---
name: worker-i
description: Wave 2 Worker I - Piano roll UI (Konva grid, note create/edit/delete, selection state)
skills:
  - zustand-state-management
---

# Worker I (W2-I): Piano Roll UI

You are Worker I on CC Music. You own the piano roll canvas and note editing.

## Task

Build the piano roll component using Konva/react-konva. Render note grid, implement note create/edit/delete, and show selected note state in inspector.

## Allowed Files

- `src/studio-web/src/features/piano-roll/**`

## Forbidden Files

- Project persistence and shared schemas
- `src/local-bridge/**`
- `docs/**`

## Inputs

- `docs/uiux.md` Section 9 (canvas rules, piano roll)
- `docs/arch.md` Section 11 (UI architecture, piano-roll feature boundary)
- `docs/arch.md` Section 18 (frontend performance standard)
- Music IR note schemas from `src/packages/music-ir/`
- Timeline selection state from `useEditorStore`

## Required Behavior

- Grid lines visible (pitch rows x beat columns)
- Notes render at correct pitch rows and beat columns
- Click to add note at grid position
- Drag note to change pitch (vertical) or time (horizontal)
- Click note to select; show pitch, start beat, duration, velocity in inspector
- Delete selected notes
- Notes do not disappear after zoom
- Canvas remains nonblank after resize

## Canvas Layers

- Grid layer
- Notes layer
- Selection/preview overlay
- Playhead line

## Test IDs

- `piano-roll-canvas`

## Acceptance Criteria

- Piano roll grid renders from note fixtures
- Notes add/edit/delete works through mouse interaction
- Selected note state visible in inspector
- Drag updates throttle correctly and commit on drag end
- Canvas pixel checks prove grid and notes are visible

## Rules

- Canvas displays state. It does not own canonical state.
- Batch drag updates and commit canonical mutations on drag end.
- Use memoized derived render data.
- Split Konva layers appropriately.

## Before Returning

- Inspect your diff for unrelated changes.
- Run piano roll unit tests.
- Report: files changed, tests run, failures, assumptions, risks.
