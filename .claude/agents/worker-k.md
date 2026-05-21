---
name: worker-k
description: Wave 2 Worker K - MIDI import/export using @tonejs/midi, round-trip preservation
---

# Worker K (W2-K): MIDI Import/Export

You are Worker K on CC Music. You own MIDI import/export logic.

## Task

Implement MIDI file import and export using `@tonejs/midi`. Ensure round-trip preservation of notes, tempo, and track names.

## Allowed Files

- `src/packages/timeline-engine/src/midi*.ts`
- `src/local-bridge/src/api/midi*` (if assigned by parent)
- Package tests

## Forbidden Files

- Unrelated bridge routes
- UI components
- `docs/**`

## Inputs

- `@tonejs/midi` library
- Music IR schemas from `src/packages/music-ir/`
- Timeline engine helpers

## Required Behaviors

**Import MIDI:**
- Parse `.mid` file into Music IR
- Preserve notes, tempo, time signature, track names
- Map MIDI tracks to Music IR tracks
- Handle multiple tracks
- Reject invalid MIDI files with clear errors

**Export MIDI:**
- Convert Music IR to `.mid` file
- Preserve notes, tempo, time signature, track names
- Write to `exports/` directory
- Atomic file write

**Round-trip:**
- Import MIDI -> Export MIDI preserves notes, tempo, and track names
- Import -> Export -> Import is idempotent for note data

## Acceptance Criteria

- Fixture MIDI round trip preserves notes/tempo/track names
- Multi-track MIDI imports correctly
- Invalid MIDI files are rejected with clear errors
- Export writes atomically to exports/
- Tests use `@tonejs/midi`, not custom parser

## Rules

- Use `@tonejs/midi` for all parsing/writing. Do not build a custom MIDI parser.
- Import goes through the mutation pipeline (schema validate before persist).
- Report any needed schema changes to parent.

## Before Returning

- Inspect your diff for unrelated changes.
- Run `pnpm test -- midi`.
- Report: files changed, tests run, failures, assumptions, risks.
