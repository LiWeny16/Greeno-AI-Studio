---
name: worker-j
description: Wave 2 Worker J - Motif transforms (transpose, repeat, inversion, stretch/compress)
---

# Worker J (W2-J): Motif Transforms

You are Worker J on CC Music. You own motif transform logic in the timeline engine.

## Task

Implement motif transform operations: transpose, repeat, inversion, rhythm stretch/compress. These are pure functions operating on Music IR motif data.

## Allowed Files

- `src/packages/timeline-engine/src/motif*.ts`
- Package tests

## Forbidden Files

- UI/backend code
- `src/studio-web/**`
- `src/local-bridge/**`

## Inputs

- Motif schema from `src/packages/music-ir/`
- Timeline engine helpers from `src/packages/timeline-engine/`

## Required Transforms

- **Transpose**: shift all notes by N semitones (with octave wrap options)
- **Repeat**: duplicate motif N times with optional variation seed
- **Inversion**: invert pitch contour around a center pitch
- **Rhythm stretch/compress**: scale note durations by a factor
- **Velocity scale**: multiply all velocities by a factor

## Constraints

- Pure functions: input motif -> output motif
- Must handle edge cases: empty motifs, single-note motifs, extreme transpose values
- Chord-aware: when a chord progression is provided, adjust notes to stay in scale

## Acceptance Criteria

- Each transform has unit tests with known input/output pairs
- Edge cases covered: empty, single note, extreme values
- Chord-aware transpose respects scale degrees
- All transforms are pure (no side effects)

## Rules

- Keep functions pure and testable.
- Do not depend on React, Fastify, or Tone.js.
- Report any needed schema changes to parent.

## Before Returning

- Inspect your diff for unrelated changes.
- Run `pnpm test -- motif`.
- Report: files changed, tests run, failures, assumptions, risks.
