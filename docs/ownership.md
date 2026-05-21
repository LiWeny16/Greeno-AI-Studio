# CC Music Subagent Ownership Table

Last updated: 2026-05-21

This table is the control plane for multi-agent implementation. The parent agent updates it before assigning work. Workers must stay inside their allowed files and report blockers instead of widening scope.

## Current Rule

Do not start UI-heavy feature work until Wave 0 is complete:

- git initialized if missing.
- root `.gitignore` protects `docs/reference-projects/*` except its README and `.gitignore`.
- pnpm workspace exists.
- `pnpm typecheck`, `pnpm test`, and mocked `pnpm test:e2e` exist.
- Music IR, project manifest/event, agent/job, and tool registry schemas exist with fixtures.
- Playwright uses temp project roots and backend-level mock adapters.

## Shared Files

Parent-owned unless explicitly assigned:

- `package.json`
- lockfile
- `pnpm-workspace.yaml`
- root TypeScript, lint, test, and Playwright config
- `.github/workflows/**`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/**`
- `src/packages/music-ir/**`
- `src/packages/agent-protocol/**`
- `src/packages/tool-registry/**`
- `src/workers/python/cc_music/schema/**`
- global styles and app root layout

## Wave 0

| Task ID | Owner | Allowed Files | Forbidden Files | Required Tests |
|---|---|---|---|---|
| W0-P | Parent | `CLAUDE.md`, `AGENTS.md`, `docs/**`, root `.gitignore`, `.editorconfig` | Feature code | Verify reference clones ignored |
| W0-A | Worker A | root package manager/config files, `src/studio-web/**`, `.github/workflows/**` | shared schemas after creation | `pnpm typecheck`, `pnpm test` scripts exist |
| W0-B | Worker B | `src/packages/music-ir/**` | frontend/backend feature code | schema validation tests |
| W0-C | Worker C | `src/packages/timeline-engine/**` | React code | bar/beat/selection tests |
| W0-D | Worker D | `src/packages/agent-protocol/**`, `src/packages/tool-registry/**` | backend adapters and UI | agent/job/registry schema tests |

## Wave 1

| Task ID | Owner | Allowed Files | Forbidden Files | Required Tests |
|---|---|---|---|---|
| W1-F | Worker F | `src/studio-web/src/app/**`, shell components | timeline/piano-roll internals | app shell unit/smoke checks |
| W1-G | Worker G | `src/studio-web/src/features/timeline/**` | project persistence and schemas | timeline render/selection tests |
| W1-H | Worker H | `src/tests/e2e/**`, `playwright.config.*`, test helpers | production feature behavior | mocked app smoke and timeline-selection E2E |

## Wave 2

| Task ID | Owner | Allowed Files | Forbidden Files | Required Tests |
|---|---|---|---|---|
| W2-I | Worker I | `src/studio-web/src/features/piano-roll/**` | project persistence and shared schemas | piano-roll unit/E2E |
| W2-J | Worker J | `src/packages/timeline-engine/src/motif*.ts`, package tests | UI/backend | motif transform tests |
| W2-K | Worker K | MIDI helper files in `src/packages/timeline-engine/**`, backend MIDI API if assigned | unrelated backend routes | MIDI round-trip tests |

## Wave 3

| Task ID | Owner | Allowed Files | Forbidden Files | Required Tests |
|---|---|---|---|---|
| W3-L | Worker L | `src/packages/agent-protocol/**` if assigned by parent | unapproved schema changes | stream/proposal schema tests |
| W3-La | Worker La | `src/packages/agent-protocol/src/tools*.ts` | backend adapters, UI | tool schema + registry tests |
| W3-M | Worker M | `src/workers/python/cc_music/agent/**` and `src/workers/python/cc_music/api/**` | project file format | Python mock ReAct loop tests via pytest, FastAPI agent route tests |
| W3-N | Worker N | `src/studio-web/src/features/agent-panel/**` (streaming thought log, diff display) | backend adapters | agent patch E2E with streaming |
| W3-O | Worker O | `src/packages/timeline-engine/src/undo*.ts`, `src/workers/python/cc_music/api/` | unrelated UI | undo/snapshot tests |

## Wave 4

| Task ID | Owner | Allowed Files | Forbidden Files | Required Tests |
|---|---|---|---|---|
| W4-P | Worker P | `src/studio-web/src/features/transport/**`, playback helpers | Music IR schema | playback tests |
| W4-Q | Worker Q | export route and export UI command | unrelated import/audio work | MIDI export E2E |
| W4-R | Worker R | `src/tests/e2e/demo-flow.spec.ts`, demo fixtures | product code unless assigned | full demo E2E |

## Worker Return Format

Each worker reports:

- files changed.
- tests run.
- test failures, if any.
- assumptions.
- risks.
- any parent decision needed.
