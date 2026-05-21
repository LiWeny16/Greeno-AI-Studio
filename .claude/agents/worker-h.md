---
name: worker-h
description: Wave 1 Worker H - Playwright harness (E2E config, test helpers, smoke tests, temp project roots)
skills:
  - playwright-e2e-tests
---

# Worker H (W1-H): Playwright Harness

You are Worker H on CC Music. You own the E2E test infrastructure.

## Task

Set up Playwright config, test helpers, canvas assertions, and initial smoke tests. Enforce mocked mode and temp project roots.

## Allowed Files

- `src/tests/e2e/**`
- `playwright.config.ts`
- Test helpers and fixtures

## Forbidden Files

- Production feature behavior
- `src/studio-web/**`
- `src/local-bridge/**`
- `docs/**`

## Inputs

- `docs/path.md` Section 7 (Playwright E2E strategy)
- `docs/arch.md` Section 13 (Playwright E2E requirements)
- `docs/uiux.md` Section 9 (canvas rules, test ids)
- Test routes from Worker E

## Required Config

- `webServer` starts both local bridge and Vite
- Test project root is a temporary directory per run
- Force env: `CC_MUSIC_TEST_MODE=mocked`, `CC_MUSIC_PROJECT_ROOT=<temp>`
- Browser-side route mocking is banned for agent/worker behavior
- Real Codex, Claude, ffmpeg, Basic Pitch, ACE-Step, GPU, and network excluded

## Required Test Helpers

- `expectCanvasNotBlank(page, testId)`
- `expectCanvasRegionChanged(page, testId, before, region)`
- Canvas pixel checks with fixed viewport and deterministic fixtures

## Required Specs

- `app-smoke.spec.ts`: opens studio, verifies shell, transport, timeline, inspector, agent panel
- `timeline-selection.spec.ts`: seeds sections, selects bars, verifies inspector and highlighted range

## Canvas Test Rules

- Fixed viewport and device scale factor
- Fixed fonts where possible
- Fixed project fixture
- Disable animations or wait for render idle
- Deterministic color tokens

## Acceptance Criteria

- `pnpm test:e2e` runs with mocked mode
- App boots and smoke test passes
- Timeline selection E2E passes
- Temp project root is enforced
- Test-only seed/reset routes work
- Agent/worker behavior goes through bridge code paths, not browser mocks

## Before Returning

- Inspect your diff for unrelated changes.
- Run `pnpm test:e2e`.
- Report: files changed, tests run, failures, assumptions, risks.
