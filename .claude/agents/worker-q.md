---
name: worker-q
description: Wave 4 Worker Q - MIDI export workflow (bridge export route, frontend export command)
---

# Worker Q (W4-Q): Export Workflow

You are Worker Q on CC Music. You own the MIDI export workflow end-to-end.

## Task

Implement the bridge export route and frontend export command so users can export `.mid` files from the current project.

## Allowed Files

- Local bridge export route
- Frontend export command/UI
- Related tests

## Forbidden Files

- Unrelated import/audio work
- `docs/**`

## Inputs

- MIDI export helpers from Worker K
- `docs/arch.md` Section 8 (API surface: GET /api/projects/:projectId/export/midi)
- `docs/arch.md` Section 9 (exports/ directory)

## Required Behavior

**Bridge route:**
```http
GET /api/projects/:projectId/export/midi
```
- Converts current project IR to MIDI
- Writes to `exports/<filename>.mid`
- Returns file path and download URL
- Atomic file write

**Frontend:**
- Export button in top bar or menu
- File name input (default: project title)
- Download progress indicator
- Success/failure notification

## Test ID

- `export-midi`

## Acceptance Criteria

- User can export `.mid` from current project
- Exported MIDI preserves all notes, tempo, time signature, and track names
- File written atomically to exports/ directory
- Export button is accessible from the UI
- Export works end-to-end in Playwright

## Rules

- Use `@tonejs/midi` for MIDI writing (via Worker K helpers).
- Export goes through the mutation pipeline for audit events.
- Append `midi_exported` event to events.ndjson.

## Before Returning

- Inspect your diff for unrelated changes.
- Run export workflow tests.
- Report: files changed, tests run, failures, assumptions, risks.
