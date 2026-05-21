# Multi-Agent Implementation Path

## 1. Goal

Build CC Music AI Studio with many subagents while keeping changes safe, reviewable, and easy to integrate.

This path assumes the product direction from `docs/plan.md`:

- React + TypeScript + Vite frontend.
- Node + TypeScript local bridge.
- Shared schema-first packages for Music IR and timeline behavior.
- Python workers behind stable job contracts.
- Local agent integrations that propose structured changes rather than directly mutating project data.

The operating principle is simple: subagents may work quickly, but the parent agent owns architecture, interfaces, integration, tests, and final acceptance.

Current workspace status as of 2026-05-21:

- The git repository and first scaffold now exist in this root.
- Runtime app code lives under `src/studio-web` and `src/local-bridge`.
- Shared contracts live under `src/packages/*`.
- E2E tests live under `src/tests/e2e`.
- Python worker placeholders live under `src/workers/python` and are managed with `uv`.
- Reference projects are cloned under `docs/reference-projects/`; root ignore rules must protect them before the first commit.

Therefore the first implementation milestone is not a feature. It is turning these written rules into repo structure, scripts, schemas, mocks, and tests.

## 2. Ownership Boundaries

### 2.1 Parent Agent

The parent agent is the integrator and release owner.

Responsibilities:

- Reads the existing repo before splitting work.
- Defines the task graph and file ownership before worker agents start.
- Creates or approves schemas before feature work begins.
- Assigns non-overlapping file sets to workers.
- Reviews worker diffs before merging them into the main workspace.
- Runs typecheck, unit tests, integration tests, and Playwright E2E.
- Resolves cross-cutting design decisions.
- Writes or updates docs when behavior or contracts change.
- Decides whether work is done.

The parent agent should not delegate these decisions:

- Music IR shape.
- Edit command schema.
- API route contracts.
- Job lifecycle model.
- Project file layout.
- Security rules for local CLI, filesystem, and worker execution.
- Test acceptance gates.

### 2.2 Worker Agents

Worker agents are bounded implementers. They receive a narrow task, explicit files, schemas, acceptance criteria, and a no-touch list.

Worker agents may:

- Implement a focused feature inside their assigned boundary.
- Add tests for the behavior they changed.
- Add small helper functions local to the feature.
- Report missing schema/API needs back to the parent.

Worker agents must not:

- Change shared schemas without parent approval.
- Rename public APIs casually.
- Reorganize directories.
- Add large abstractions.
- Modify unrelated tests to make failures disappear.
- Change generated assets, snapshots, or lockfiles unless assigned.
- Install new dependencies unless explicitly approved.

### 2.3 Package Ownership

Recommended ownership once the repo is scaffolded:

```text
src/studio-web
  Owner: frontend parent or frontend lead worker
  Scope: React UI, feature components, state, queries, Playwright UI hooks

src/local-bridge
  Owner: backend parent or backend lead worker
  Scope: Fastify routes, WebSocket streams, project IO, job orchestration, agent adapters

src/packages/music-ir
  Owner: parent agent only by default
  Scope: Zod schemas, TypeScript types, migration helpers, patch validation

src/packages/timeline-engine
  Owner: parent agent or assigned timeline worker
  Scope: bar/beat/time math, selection model, MIDI clip boundary logic

src/workers/python
  Owner: worker-runtime specialist
  Scope: Python worker command contracts, mock workers, future Basic Pitch/ffmpeg adapters

src/tests/e2e
  Owner: QA/E2E worker, integrated by parent
  Scope: Playwright fixtures, app flows, visual/canvas checks

docs
  Owner: parent agent
  Scope: architecture, protocols, coding standards, runbooks

docs/ownership.md
  Owner: parent agent
  Scope: task IDs, allowed files, forbidden files, required tests, integration order
```

## 3. Task Split Strategy

Split work by stable interface, not by UI screen alone. Each worker should have one primary contract and one test surface.

### 3.1 Good Worker Tasks

Good tasks are small enough to integrate independently:

- Define `MusicIrSchema`, `EditCommandSchema`, and sample fixtures.
- Build project create/load/save routes against mocked storage.
- Implement timeline bar selection using existing IR fixtures.
- Implement piano-roll rendering from note fixtures without editing IR schema.
- Add agent-message API that returns mocked `ir_patch` responses.
- Add job queue state machine with mocked workers.
- Add Playwright app bootstrap and smoke test.
- Add visual/canvas assertions for timeline and piano roll.

### 3.2 Poor Worker Tasks

Avoid vague or cross-cutting assignments:

- "Build the whole frontend."
- "Make the backend work."
- "Improve architecture."
- "Add AI."
- "Refactor state management."
- "Make tests pass."

These tasks create conflicts because they touch too many files and lack clear done criteria.

### 3.3 Suggested Initial Workstreams

Milestone 0 and 1 must follow the canonical task IDs in `docs/ownership.md` and Section 15. The short version:

```text
W0-A: Workspace scaffold
  Files: package manager config, tsconfig, lint/test config, app entrypoints, CI skeleton
  Done: dev scripts boot frontend and bridge; typecheck/test/e2e scripts exist

W0-B: Music IR schema
  Files: src/packages/music-ir/**
  Done: schemas, project manifest/event schemas, fixtures, validation tests, schema docs

W0-C: Timeline engine
  Files: src/packages/timeline-engine/**
  Done: bar/beat/time conversion and selection tests

W0-D: Agent/job/tool contracts
  Files: src/packages/agent-protocol/**, src/packages/tool-registry/**
  Done: stream events, job request/result, cancellation/timeout semantics, tool registry fixtures

W1-E: Local bridge project API
  Files: src/local-bridge/src/projects/**, src/local-bridge/src/api/**
  Done: create/load/save/recover project with Music IR fixtures and events.ndjson

W1-H: Playwright harness
  Files: src/tests/e2e/**, playwright config, test fixtures
  Done: app boots, mocked bridge available, timeline smoke test passes through bridge code paths
```

Milestone 2 and 3 can then add:

```text
W2-I: Piano roll
  Files: features/piano-roll/**, selected fixtures
  Done: note grid renders, note creation/edit tests pass

W2-J: Motif transforms
  Files: src/packages/timeline-engine/src/motif*.ts or src/packages/music-ir/src/motif*.ts
  Done: transpose, repeat, inversion, stretch/compress covered by tests

W3-M: Mock agent and bridge endpoint
  Files: src/local-bridge/src/agent/**, src/local-bridge/src/api/agent*
  Done: mocked Codex/Claude adapter emits valid schema-only patches

W3-N: Diff preview/apply
  Files: studio-web agent panel, inspector, patch preview components
  Done: invalid patches rejected, valid patches previewed and applied
```

## 4. Conflict Prevention

### 4.1 File-Level Locks

Before workers start, the parent publishes a short ownership table:

```text
Task | Owner | Allowed files | Forbidden files | Expected tests
```

Workers must not edit outside allowed files. If blocked, they stop and report the needed interface change.

The canonical ownership table lives in `docs/ownership.md`. It must exist before more than one implementation worker starts.

### 4.2 Schema-First Gate

Any change crossing process or package boundaries starts with schema:

- Music IR.
- Edit command.
- Agent patch.
- Job request/result.
- Worker command payload.
- Project manifest.
- API response.

Schema changes require:

- Zod schema update.
- Type export update.
- Fixture update.
- Validation test.
- Migration note if stored data shape changes.
- Parent approval before dependent workers proceed.

### 4.3 Mock-First Integration

Do not let feature workers depend on real AI, GPU, ffmpeg, Basic Pitch, ACE-Step, or local CLI availability.

Every external system needs a deterministic mock:

- Mock AI worker returns known `ir_patch`.
- Mock audio-to-MIDI worker returns fixed MIDI notes.
- Mock render worker returns a tiny fixture asset.
- Mock image-to-brief worker returns fixed music brief fields.
- Mock agent stream returns a stable sequence of events.

Real workers are adapters behind the same schema.

### 4.4 Branch or Patch Isolation

If using git:

- Each worker works on a branch named `agent/<task-id>-<short-name>`.
- Parent merges one branch at a time.
- Parent runs tests after each merge.
- Parent reassigns follow-up fixes rather than letting workers merge blindly.

If using patch files:

- Each worker returns a patch plus test output.
- Parent applies patches one at a time.
- Parent rejects patches that include unrelated files.

### 4.5 Shared Files Policy

Shared files are high-conflict and need parent ownership:

- `package.json`
- lockfile
- root `tsconfig`
- app router/root layout
- shared schemas
- shared test setup
- global styles
- generated snapshots
- `CLAUDE.md`
- `docs/ownership.md`
- project file format docs
- tool/model registry schema

Workers may request changes to these files, but the parent applies them.

## 5. Parent Integration Loop

The parent integrates using a strict loop:

1. Confirm worker diff only touches assigned files.
2. Read changed code, not just test output.
3. Run focused tests for that boundary.
4. Run affected typecheck/lint.
5. Run relevant Playwright smoke tests if UI or API changed.
6. Check schemas and fixtures stayed consistent.
7. Update docs if behavior or contracts changed.
8. Commit or checkpoint only after the repo is green.

Integration order should follow dependency direction:

1. Shared schema.
2. Engine/package logic.
3. Backend API.
4. Frontend state and UI.
5. E2E tests.
6. Real worker adapters.

Do not integrate frontend UI that depends on backend behavior before the API contract and mocks exist.

## 6. Definition of Done

### 6.1 Worker Done

A worker task is done when:

- All assigned acceptance criteria pass.
- Tests were added or updated for changed behavior.
- The worker reports exact commands run and results.
- No unrelated files were modified.
- Public schemas or APIs are documented if changed.
- Mock behavior exists for any external dependency.
- The worker leaves no TODO that blocks the milestone.

### 6.2 Parent Done

A milestone is done when:

- `typecheck`, `lint`, unit tests, and Playwright pass in the integrated repo.
- E2E covers the user-visible flow for the milestone.
- Visual/canvas checks verify the timeline and piano roll are not blank or badly framed.
- AI/worker paths can run with deterministic mocks.
- Real external tools are optional and surfaced through capabilities.
- Docs describe any new protocol, schema, or workflow.
- The app can be started locally from documented commands.

### 6.3 Product Done for MVP Core Loop

The MVP core loop is done when a user can:

1. Create or open a project.
2. See sections on a timeline.
3. Select a bar range.
4. Enter or import a motif.
5. Ask the agent for a structured change.
6. Preview the diff.
7. Apply the patch.
8. See the timeline/piano-roll update.
9. Play or render a mocked preview.
10. Undo or inspect version history.

## 7. Playwright E2E Strategy

Hard gates before UI work:

- One canonical `playwright.config.ts`.
- `webServer` starts both the local bridge and Vite.
- Test project root is a temporary directory per run.
- `CC_MUSIC_TEST_MODE=mocked` is mandatory.
- Browser-side route mocking is banned for agent/worker behavior; tests must exercise bridge routes and mock adapters.
- Real Codex, Claude, ffmpeg, Basic Pitch, ACE-Step, GPU, and network are not required for default tests.

### 7.1 Test Modes

Use three E2E modes:

```text
mocked
  Default CI/local mode. No real AI, no GPU, no ffmpeg required.

adapter
  Tests local bridge adapters with fake subprocesses and fixture files.

manual-real
  Optional developer run against installed ffmpeg, Basic Pitch, Codex/Claude CLI, or audio models.
```

Only `mocked` is required for every parent integration.

### 7.2 Local App Startup

Playwright should start both services:

- Vite frontend on a known port.
- Node local bridge on a known port.

Use environment variables to force deterministic behavior:

```text
CC_MUSIC_TEST_MODE=mocked
CC_MUSIC_PROJECT_ROOT=<temp-dir>
CC_MUSIC_AI_WORKERS=mock
CC_MUSIC_AGENT_ADAPTER=mock
CC_MUSIC_RENDER_WORKER=mock
```

The app should expose a test-only seed route or fixture import:

```http
POST /api/test/reset
POST /api/test/seed-project
```

These routes are enabled only when `CC_MUSIC_TEST_MODE=mocked`.

They must also require `CC_MUSIC_PROJECT_ROOT` to be a temp path. Test mode must never read or mutate real user projects.

### 7.3 Core E2E Flows

Minimum Playwright suite:

```text
app-smoke.spec.ts
  Opens studio, verifies shell, transport, timeline, inspector, agent panel.

project-flow.spec.ts
  Creates project, saves BPM/key/time signature, reloads project.

timeline-selection.spec.ts
  Seeds sections, selects bars 9-16, verifies inspector and highlighted range.

piano-roll.spec.ts
  Seeds notes, verifies piano roll grid, adds/edits/deletes a note.

agent-patch.spec.ts
  Sends text prompt to mocked agent, receives valid IR patch, previews diff, applies patch.

job-queue.spec.ts
  Starts mocked render/generation job, verifies queued/running/succeeded states and asset output.

version-history.spec.ts
  Applies patch, creates snapshot, reverts to previous version.
```

### 7.4 Mocked AI Workers

Mock workers should be implemented as real code paths, not Playwright-only stubs in the browser.

Recommended contracts:

```json
{
  "type": "agent_ir_patch",
  "input": {
    "prompt": "make bars 9-16 darker",
    "selection": { "barRange": [9, 16] },
    "snapshotId": "snap_test_001"
  },
  "output": {
    "type": "ir_patch",
    "summary": "Restyle selected bars as dark minimal electronic.",
    "patch": [
      {
        "op": "replace",
        "path": "/sections/1/style/genre",
        "value": "dark minimal electronic"
      }
    ]
  }
}
```

The mock should also support failure cases:

- Invalid JSON.
- Schema-invalid patch.
- Worker timeout.
- Worker cancellation.
- Partial stream followed by error.

E2E must prove the UI rejects invalid patches and keeps the project unchanged.

### 7.5 Visual and Canvas Checks

Timeline, waveform, and piano-roll are canvas-heavy surfaces. DOM assertions are not enough.

Use layered checks:

- DOM: canvas exists with expected CSS size.
- Pixel: canvas is not blank.
- Pixel: key regions changed after selection or note edit.
- Screenshot: stable visual baseline for timeline and piano roll.
- Interaction: clicking a known coordinate selects the expected bar or note.

Recommended helper assertions:

```ts
await expect(locator).toHaveCSS("width", /.+px/);
await expectCanvasNotBlank(page, "[data-testid='timeline-canvas']");
await expectCanvasRegionChanged(page, "[data-testid='timeline-canvas']", before, {
  x: 200,
  y: 20,
  width: 160,
  height: 80
});
await expect(page).toHaveScreenshot("timeline-selected-bars.png");
```

Canvas test data must be deterministic:

- Fixed viewport.
- Fixed device scale factor.
- Fixed fonts where possible.
- Fixed project fixture.
- Disable animations or wait for render idle.
- Deterministic color tokens for selected/locked/dirty states.

### 7.6 Timeline/Piano-Roll Specific Acceptance

Timeline visual checks:

- Sections render in correct order and width ratio.
- Selected bar range is visible and aligned.
- Locked sections show lock state.
- Dirty section state appears after patch preview.
- Job progress indicator does not cover timeline labels.

Piano-roll visual checks:

- Grid lines visible.
- Notes render at correct pitch rows and beat columns.
- Dragging a note changes pitch/time.
- Selected note state is visible.
- Notes do not disappear after zoom.
- Canvas remains nonblank after resize.

## 8. Agent Self-Closure Loops

Each worker agent should close its own task before returning. The parent should require this loop in worker prompts.

### 8.1 Worker Self-Closure Prompt

Every worker task should end with:

```text
Before returning:
1. Re-read your assigned acceptance criteria.
2. Inspect your diff and remove unrelated changes.
3. Run the narrowest relevant tests.
4. If tests fail, fix and rerun once.
5. Report files changed, tests run, failures remaining, and any parent decisions needed.
```

### 8.2 Parent Self-Closure Loop

Before marking a milestone done, the parent runs:

```text
1. Re-read docs/plan.md and the milestone acceptance criteria.
2. Check integrated files against ownership boundaries.
3. Run full required verification.
4. Open the app through Playwright, not just unit tests.
5. Verify mocked worker paths are deterministic.
6. Verify no real AI or external binary is required for default tests.
7. Update docs and CLAUDE.md if rules changed.
8. Summarize residual risks.
```

### 8.3 Failure Handling

When a worker fails:

- Keep the failed patch isolated.
- Extract useful tests or fixtures if they are valid.
- Reassign with a smaller boundary.
- Do not let another worker repair the failure by broad refactor unless the parent changes the plan.

When integration fails:

- Identify whether the failure is schema, API, UI state, timing, or test fixture drift.
- Fix the lowest dependency layer first.
- Rerun the smallest failing test before the full suite.

## 9. Security and Safety Rules

Local app safety matters because the product runs agents and worker processes on the user's machine.

Required constraints:

- Browser never directly launches local CLI tools.
- Local bridge owns all subprocess execution.
- Local bridge restricts cwd to project/workspace directories.
- Command execution uses an allowlist.
- HTTP and WebSocket calls require exact Origin validation plus local token.
- Reject `Origin: null`, wildcard CORS, and absent browser Origin.
- Subprocess adapters use resolved executable allowlists, argument arrays, minimal env, output byte limits, and process-tree cancellation.
- Destructive file operations require explicit user confirmation.
- Agent output is proposal-only by default.
- Project mutations go through schema validation and version snapshots.
- External model adapters are disabled unless capability checks pass.
- Logs redact secrets and local tokens.
- Test mode cannot access real user project directories.

## 10. Agent Coding Standard

The canonical coding standard is the root `CLAUDE.md`. Do not duplicate a second copy here.

Every worker must read:

- `CLAUDE.md`
- `AGENTS.md`
- `docs/plan.md`
- `docs/arch.md`
- `docs/path.md`
- `docs/ownership.md`
- `docs/uiux.md` for frontend or Playwright work

The important constraints are:

- MIDI-first MVP only.
- Schema-first for stored or cross-process data.
- Project file contract first.
- Single mutation pipeline.
- Mock-first tests.
- Local bridge security as a release gate.
- Strict allowed-files ownership.

## 11. First Practical Execution Plan

Start with a small, controlled multi-agent run:

1. Parent initializes git if missing and adds root `.gitignore`, `.editorconfig`, package manager plan, CI plan, `CLAUDE.md`, and `docs/ownership.md`.
2. Worker A scaffolds workspace and app boot.
3. Worker B defines `src/packages/music-ir` schemas and fixtures.
4. Worker C defines `src/packages/timeline-engine` time/selection helpers.
5. Worker D defines `src/packages/agent-protocol` and minimal worker/job event contracts.
6. Parent integrates A/B/C/D and runs typecheck/unit tests.
7. Worker E builds mocked local bridge project API.
8. Worker F builds studio shell and timeline render from fixtures.
9. Worker G adds Playwright mocked app startup and timeline smoke test.
10. Parent integrates E/F/G and runs Playwright.
11. Only then assign piano-roll, agent patch, job queue, and real worker adapters.

This sequence keeps the repo stable because UI and backend workers depend on schemas and fixtures that already exist.

## 12. Recommended Parent Prompt Template for Workers

```text
You are Worker <ID> on CC Music.

Task:
<one focused task>

Allowed files:
<explicit file or directory list>

Do not edit:
<shared files and unrelated directories>

Inputs:
<schemas, fixtures, APIs, docs>

Acceptance criteria:
<specific behavior>

Required tests:
<commands or test names>

Rules:
- Inspect existing code before editing.
- Keep code simple.
- Do not change schemas unless this task explicitly says so.
- Use mocks for AI/workers.
- Report any needed parent decision instead of broadening the task.

Before returning:
- Inspect your diff.
- Run required tests.
- Report files changed, tests run, failures, and risks.
```

## 13. Summary Recommendation

Use many subagents only after the parent has frozen the initial contracts. Let workers own leaf implementation areas, not architecture. Make schemas, fixtures, mocks, and Playwright the integration spine. Keep AI and audio workers mocked by default so the app can be built and tested locally without fragile dependencies. Treat the parent agent as the only actor allowed to merge cross-boundary changes and define done.

## 14. Required Skills During Development

Use skills deliberately; do not keep a skill active across turns unless it is re-triggered by the task.

### 14.1 Current planning/research skills

```text
tavily-search
  Use when current web research is needed for open-source projects, licenses, docs, or competitor updates.
  Note: the local `tvly` CLI is not installed in this workspace as of 2026-05-21, so fallback research may require browser search or installing/login approval.
```

### 14.2 Likely implementation skills

```text
react-performance-optimization
  Use when timeline/piano-roll rendering is slow, React re-rendering is excessive, or canvas state boundaries need tuning.

openai-docs
  Use when implementing or documenting Codex/OpenAI API behavior. Only rely on official OpenAI docs for product/API facts.
```

### 14.3 Optional future skills

```text
imagegen
  Use only for product mockup imagery, test placeholder bitmaps, or marketing assets. Do not use it for core UI code.

skill-creator
  Use if the team decides to create a project-specific CC Music skill for repeated Music IR, MIDI, or agent-patch workflows.

seo-geo / copywriting
  Use later for landing page/search positioning, not during MVP engineering.
```

### 14.4 Skills not needed for MVP

Do not use unrelated Lark, CRM, startup, nutrition, or ops skills unless the user explicitly shifts the task into those domains.

## 15. Narrow MVP Task Breakdown For Subagents

The MVP is intentionally smaller than the original plan. Audio generation, Basic Pitch, ACE-Step, Demucs, image input, and notation are post-MVP adapters. The first multi-agent run should produce this loop:

```text
create project
  -> timeline sections
  -> piano-roll motif
  -> mocked AI patch
  -> diff preview
  -> apply/undo
  -> playback/export MIDI
```

### 15.1 Wave 0: Contracts and Guardrails

Run these before assigning UI-heavy work.

```text
Parent: Root guardrails
  Owns: CLAUDE.md, AGENTS.md, root docs, docs/ownership.md, root ignore rules
  Done: worker prompt template and ownership table exist; reference clones are ignored

Worker A: Workspace scaffold
  Allowed: package manager config, app/package shells, tsconfig, eslint/vitest/playwright config, CI skeleton
  Done: app and bridge can start with empty pages/routes; pnpm typecheck/test/test:e2e scripts exist

Worker B: Music IR contracts
  Allowed: src/packages/music-ir/**
  Done: Zod schemas, project manifest/event schemas, fixtures, validation tests, migration stub

Worker C: Timeline engine contracts
  Allowed: src/packages/timeline-engine/**
  Done: bar/beat/time math, section range helpers, selection tests

Worker D: Agent/job/tool contracts
  Allowed: src/packages/agent-protocol/**, src/packages/tool-registry/**
  Done: request/result/stream-event schemas, cancellation/timeout semantics, tool registry schema and fixtures
```

Parent integration gate:

```text
pnpm typecheck
pnpm test
```

If those commands do not exist yet, Worker A must define them before the gate is considered passable.

Golden fixtures required before Wave 1:

- valid project.
- invalid Music IR.
- valid agent patch.
- schema-invalid agent patch.
- invalid JSON agent output.
- timeout stream.
- cancellation stream.
- partial stream then error.
- adapter dependency missing.

### 15.2 Wave 1: Local Bridge and Workbench Shell

```text
Worker E: Local bridge project API
  Allowed: src/local-bridge/src/api/**, src/local-bridge/src/projects/**
  Inputs: Music IR schemas and fixtures
  Done: create/load/save project, strict project folder contract, events.ndjson append, crash recovery, test-only seed/reset routes, schema validation

Worker F: Studio shell
  Allowed: src/studio-web/src/app/**, shared shell components, feature layout only
  Inputs: mocked project API, docs/uiux.md
  Done: top bar, left rail, center editor, right inspector, bottom panel render from fixtures using approved UI primitives

Worker G: Timeline UI
  Allowed: src/studio-web/src/features/timeline/**
  Inputs: timeline-engine, Music IR fixtures, docs/uiux.md canvas rules
  Done: section blocks render, bar range selection updates inspector

Worker H: Playwright harness
  Allowed: src/tests/e2e/**, Playwright config, test helpers
  Inputs: test routes from Worker E
  Done: smoke and timeline-selection specs pass in mocked mode; temp project root enforced; browser route mocks avoided
```

Parent integration gate:

```text
pnpm typecheck
pnpm test
pnpm test:e2e -- --project=chromium
```

### 15.3 Wave 2: MIDI Editing Core

```text
Worker I: Piano roll UI
  Allowed: src/studio-web/src/features/piano-roll/**
  Inputs: Music IR notes, timeline selection, docs/uiux.md canvas rules
  Done: grid renders, notes add/edit/delete, selected note state visible

Worker J: Motif transforms
  Allowed: src/packages/timeline-engine/src/motif*.ts, package tests
  Inputs: Motif schema
  Done: transpose, repeat, inversion, rhythm stretch/compress with tests

Worker K: MIDI import/export
  Allowed: src/packages/timeline-engine/src/midi*.ts, src/local-bridge/src/api/midi* if needed
  Inputs: @tonejs/midi
  Done: fixture MIDI round trip preserves notes/tempo/track names
```

Parent integration gate:

```text
pnpm test -- motif
pnpm test -- midi
pnpm test:e2e -- piano-roll
```

### 15.4 Wave 3: Agent Patch Loop

```text
Worker L: Agent protocol schemas
  Allowed: src/packages/agent-protocol/** and package tests
  Inputs: EditCommandSchema, IrPatchProposalSchema
  Done: typed stream events and proposal schema tests

Worker M: Mock agent + bridge endpoint
  Allowed: src/local-bridge/src/agent/**, src/local-bridge/src/api/agent*
  Inputs: agent-protocol, Music IR fixtures
  Done: mocked streaming agent emits valid and invalid patch fixtures

Worker N: Diff preview/apply UI
  Allowed: src/studio-web/src/features/agent-panel/**, version-history UI if needed
  Inputs: mock agent endpoint
  Done: prompt -> proposal -> diff -> apply/reject flow

Worker O: Undo/version history
  Allowed: src/packages/timeline-engine/src/undo*.ts, src/local-bridge/src/projects/snapshots*
  Inputs: patch apply pipeline
  Done: every applied AI patch creates snapshot and can be undone
```

Parent integration gate:

```text
pnpm test -- agent
pnpm test:e2e -- agent-patch
pnpm test:e2e -- version-history
```

### 15.5 Wave 4: Playback and Demo Hardening

```text
Worker P: Browser playback
  Allowed: src/studio-web/src/features/transport/**, playback helpers
  Inputs: Music IR clips, Tone.js
  Done: play/stop/seek schedules visible notes in mocked fixture

Worker Q: Export workflow
  Allowed: local bridge export route, frontend export command
  Inputs: @tonejs/midi round-trip helper
  Done: user exports `.mid` from current project

Worker R: Full demo E2E
  Allowed: src/tests/e2e/demo-flow.spec.ts and fixtures
  Inputs: all MVP surfaces
  Done: 10-step demo from plan.md passes end to end
```

Parent final MVP gate:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## 16. Post-MVP Adapter Task Queue

Do not start these until the MIDI-first MVP is green.

```text
Adapter 1: Basic Pitch audio-to-motif
  Reuse: spotify/basic-pitch
  Worker boundary: src/workers/python/audio_to_midi/** and typed job contract
  Test: mock audio-to-MIDI first; real test optional/manual

Adapter 2: FluidSynth/ffmpeg render
  Reuse: FluidSynth/FluidLite and ffmpeg
  Worker boundary: src/workers/python/midi_render/**
  Test: fixture MIDI -> WAV metadata; real binary optional/manual

Adapter 3: Image-to-music-brief
  Reuse: OpenCLIP or local VLM
  Worker boundary: src/workers/python/image_to_brief/** or local-bridge adapter
  Test: fixture image -> deterministic brief

Adapter 4: ACE-Step audio generation
  Reuse: ACE-Step 1.5 server/API
  Worker boundary: src/workers/python/acestep/** or bridge adapter
  Test: mock generation job; real generation manual only

Adapter 5: Demucs stem separation
  Reuse: Demucs
  Worker boundary: src/workers/python/stem_separation/**
  Test: mock stems first; real model optional/manual
```

Each adapter must add a `model-registry` or `tool-registry` entry:

```json
{
  "name": "Basic Pitch",
  "role": "audio_to_midi",
  "license": "Apache-2.0",
  "commercialAllowed": true,
  "defaultEnabled": false,
  "requiresNetworkAfterSetup": false,
  "requiresGpu": false,
  "notes": "Verify transitive dependencies before release."
}
```
