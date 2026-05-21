# CC Music Coding Standard

## Product Law

- Build the MIDI-first MVP first.
- Do not turn this into a full DAW, Suno clone, audio-generation studio, or node graph editor.
- The core loop is: project -> timeline -> motif -> AI patch proposal -> diff preview -> apply/undo -> MIDI export.
- Real AI/audio/model workers are optional adapters. Default tests must use mocks.
- Enterprise-grade means strong local contracts, not enterprise features in MVP.

## Read First

- Inspect existing code before editing.
- Follow current names, layout, and patterns.
- Keep changes inside assigned files.
- Ask before changing shared schemas, root config, dependencies, directory structure, or project format.

## Code Style

- Write simple code.
- Prefer plain functions and explicit data flow.
- Avoid large abstractions until repeated code proves the need.
- Do not add framework layers for hypothetical future use.
- Keep modules small and named by product behavior.
- Use TypeScript types derived from Zod schemas at boundaries.
- Follow `docs/uiux.md` for UI components, icons, layout, and state rules.
- Follow `docs/arch.md` for approved dependencies and backend architecture.
- Follow `docs/ownership.md` when working as a subagent.

## Schema First

- Any cross-process or stored data change starts with a schema.
- Update schema, fixtures, validation tests, and docs together.
- Reject unvalidated AI, worker, file, or network input.
- Never let agent text directly mutate project state.
- AI returns proposals; UI validates and previews before Apply.

## Project Files

- MVP projects are folders with `manifest.json`, `project.json`, `snapshots/*.json`, `events.ndjson`, and `exports/*.mid`.
- `project.json` is canonical Music IR.
- Write project files atomically and recover from the latest valid snapshot when needed.
- Append local audit events for project save, patch proposed/previewed/applied/rejected, undo/redo, MIDI import/export, capability checks, and adapter failure.
- Keep undo/redo, snapshots, and audit events as separate mechanisms.

## Mutation Pipeline

- All canonical changes go through: `UI command -> EditCommand/IrPatchProposal -> validate -> preview -> snapshot -> apply -> persist -> query invalidate`.
- Canvas drag, inspector edits, agent patches, MIDI import, undo/redo, and transforms must not bypass this path.
- Project state and render state stay separate.

## Tests

- Run the narrowest relevant test after each change.
- Add tests for new behavior and bug fixes.
- Use mocked AI/workers for default tests.
- Do not require GPU, ffmpeg, Basic Pitch, ACE-Step, Claude, or Codex for CI.
- For UI changes, run the relevant Playwright test.
- For timeline or piano-roll changes, include canvas or screenshot checks.

## React

- Keep canonical project data outside visual-only components.
- Keep UI state local unless shared behavior requires a store.
- Use stable test ids for E2E-critical controls and canvases.
- Keep timeline, piano-roll, inspector, agent panel, transport, and job queue boundaries clear.
- Canvas displays state; it does not own canonical state.
- Use shadcn/ui-style local components, Radix primitives, and lucide-react icons.
- Do not add MUI, Ant Design, Chakra, Mantine, Redux, MobX, XState, Next.js, Electron, or Tauri in MVP.

## Node Bridge

- Validate every request and response.
- Keep subprocess execution behind adapters.
- Use allowlisted commands.
- Require exact Origin validation and local token for HTTP and WebSocket browser calls.
- Reject wildcard CORS, `Origin: null`, and absent browser Origin.
- Use resolved executable allowlists, argument arrays, minimal env, byte-limited output, and process-tree cancellation for subprocesses.
- Keep project file writes versioned and reversible.
- Stream job and agent events through typed messages.
- Browser never launches local CLI tools directly.

## Workers

- Workers receive typed input and return typed output.
- Real workers and mock workers implement the same contract.
- Make failures explicit: invalid input, timeout, cancelled, dependency missing.
- Do not read or write outside the assigned project directory.

## Capabilities

- Missing local tools disable or hide features; they do not break MVP.
- Keep a minimal tool/model registry with license, commercial-use, GPU/network, and test-mode fields.
- Do not build model marketplace, downloader, plugin SDK, cloud accounts, RBAC, or telemetry upload in MVP.

## Done

- Diff contains only intended files.
- Typecheck passes when available.
- Relevant unit tests pass when available.
- Relevant Playwright tests pass when available.
- Docs are updated for changed contracts.
- Remaining risks are reported clearly.
