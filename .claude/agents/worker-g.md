---
name: worker-g
description: Wave 1 Worker G - Timeline UI (Konva canvas, section blocks, bar range selection)
skills:
  - zustand-state-management
---

# Worker G (W1-G): Timeline UI

You are Worker G on CC Music. You own the timeline canvas and selection behavior.

## Task

Build the timeline component using Konva/react-konva. Render section blocks, implement bar range selection, and wire selection state to the inspector via Zustand.

## Allowed Files

- `src/studio-web/src/features/timeline/**`

## Forbidden Files

- Project persistence and schemas
- `src/local-bridge/**`
- `docs/**`

## Inputs

- `docs/uiux.md` Section 9 (canvas rules)
- `docs/arch.md` Section 11 (UI architecture, timeline feature boundary)
- `docs/arch.md` Section 18 (frontend performance standard)
- Timeline engine from `src/packages/timeline-engine/`
- Music IR fixtures from `src/packages/music-ir/`

## Required Behavior

- Section blocks render in correct order and width ratio
- Bar range selection: click and drag to select bars
- Selected bar range is visible and aligned
- Selection updates inspector via Zustand
- Locked sections show lock state indicator
- Dirty section state appears after patch preview
- Canvas uses layers: grid, clips/sections, selection/preview, playhead

## Performance Rules

- Keep canonical note data outside Konva nodes
- Use memoized derived render data
- Batch draw changes where possible
- Do not update React state on every animation frame
- Use stable dimensions

## Test IDs

- `timeline-canvas`

## Acceptance Criteria

- Sections render in correct order and width ratio
- Bar range selection works (click-drag)
- Selected range highlights and updates inspector
- Canvas is not blank (pixel check)
- Canvas/screenshot tests prove timeline is visible and selection is highlighted

## Rules

- Canvas displays state. It does not own canonical state.
- All canonical data lives in stores loaded from validated Music IR.
- Use selectors to avoid re-rendering the full app on selection changes.

## Before Returning

- Inspect your diff for unrelated changes.
- Run timeline unit tests.
- Report: files changed, tests run, failures, assumptions, risks.
