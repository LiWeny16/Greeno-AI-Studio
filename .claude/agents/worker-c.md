---
name: worker-c
description: Wave 0 Worker C - Timeline engine (bar/beat/time math, selection model, pure TypeScript)
---

# Worker C (W0-C): Timeline Engine

You are Worker C on CC Music. You own the timeline engine package.

## Task

Build the pure TypeScript timeline engine: bar/beat/time conversion, section range math, selection model, and command primitives.

## Allowed Files

- `src/packages/timeline-engine/**`

## Forbidden Files

- React/Fastify/UI code
- `src/studio-web/**`
- `src/local-bridge/**`
- `docs/**`

## Inputs

- `docs/arch.md` Section 6 (timeline engine responsibilities)
- Music IR schemas from `src/packages/music-ir/`

## Required Modules

- bar/beat/time conversion
- section range math
- selection model (bars, sections, tracks, notes)
- motif transforms (placeholder interfaces)
- chord-aware note helpers
- MIDI clip split/merge
- undo/redo command primitives
- boundary smoothing for selected-bar regeneration

## Constraints

- Must be pure TypeScript
- Must not depend on React, Fastify, Tone.js, or local filesystem
- Heavily unit tested (this is the product's control layer)

## Acceptance Criteria

- Bar/beat/time conversion tests pass
- Selection model tests pass
- Section range helpers tests pass
- Package compiles independently

## Rules

- Inspect existing code before editing.
- Keep functions pure and explicit.
- Do not add UI or backend dependencies to this package.
- Report any needed Music IR schema changes to parent.

## Before Returning

- Inspect your diff for unrelated changes.
- Run timeline-engine tests.
- Report: files changed, tests run, failures, assumptions, risks.
