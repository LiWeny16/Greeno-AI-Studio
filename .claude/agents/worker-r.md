---
name: worker-r
description: Wave 4 Worker R - Full demo E2E (10-step demo flow, end-to-end integration test)
skills:
  - playwright-e2e-tests
---

# Worker R (W4-R): Full Demo E2E

You are Worker R on CC Music. You own the full demo E2E test that proves the MVP core loop.

## Task

Write the 10-step demo E2E test that exercises the complete MVP loop end-to-end. Create demo fixtures and seed data.

## Allowed Files

- `src/tests/e2e/demo-flow.spec.ts`
- Demo fixtures
- Related test helpers

## Forbidden Files

- Product code unless assigned
- `src/studio-web/**`
- `src/local-bridge/**`
- `docs/**`

## Inputs

- All existing E2E specs and helpers
- `docs/plan.md` Section 7 (core product loop, demo script)
- `docs/path.md` Section 7.3 (core E2E flows)

## The 10-Step Demo Script

```text
1. Open app.
2. Create a 120 BPM A minor project.
3. Enter motif: A4 C5 E5 D5.
4. Generate an 8-bar piano phrase.
5. Duplicate it to 16 bars.
6. Select bars 9-16.
7. Prompt: "make this a darker, higher-energy electronic variation, keep the motif recognizable."
8. Preview 3 variations.
9. Apply one.
10. Export MIDI.
```

## Required Specs (complete before demo)

- `app-smoke.spec.ts`: shell, transport, timeline, inspector, agent panel
- `project-flow.spec.ts`: create, save BPM/key/time signature, reload
- `timeline-selection.spec.ts`: seed sections, select bars, verify inspector
- `piano-roll.spec.ts`: seed notes, grid, add/edit/delete
- `agent-patch.spec.ts`: prompt -> mock agent -> valid IR patch -> preview -> apply
- `job-queue.spec.ts`: mocked job queued/running/succeeded states
- `version-history.spec.ts`: apply patch, create snapshot, revert
- `demo-flow.spec.ts`: full 10-step demo

## Acceptance Criteria

- Full 10-step demo passes end-to-end
- No GPU, ffmpeg, Basic Pitch, ACE-Step, Claude, or Codex required
- All tests use mocked mode with temp project root
- Playwright visual/canvas checks included for key steps
- Demo fixtures are deterministic

## Rules

- Mocked mode only for default tests.
- Browser-side route mocking is banned.
- Tests must exercise bridge routes and mock adapters.
- Real external tools excluded from default E2E.
- Use stable test ids, fixed viewport, deterministic fixtures.

## Before Returning

- Inspect your diff for unrelated changes.
- Run `pnpm test:e2e`.
- Report: files changed, tests run, failures, assumptions, risks.
