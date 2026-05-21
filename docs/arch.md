# CC Music Technical Architecture

Last updated: 2026-05-21

## 1. Architecture Goal

The architecture optimizes for controllable MIDI composition, not full-song audio generation.

Core rule:

```text
Music IR is source of truth.
MIDI is the editable musical surface.
Audio/model tools are optional adapters.
Agents propose structured patches; users apply them.
```

## 2. System Overview

Architecture principle: **frontend is pure UI, backend does all compute.**

```text
┌─────────────────────────────────────────────────┐
│  Browser UI (React/TS/Vite)                     │
│  ONLY: render state, capture input, playback    │
│  NEVER: AI logic, music transforms, heavy calc  │
│  Tone.js, Konva, lucide-react, Radix            │
└──────────────────┬──────────────────────────────┘
                   │ HTTP + WebSocket
                   ▼
┌─────────────────────────────────────────────────┐
│  Local Bridge (Node/TS/Fastify)                 │
│  ONLY: route messages, manage project files,    │
│        spawn/kill Python workers, stream events │
│  NEVER: AI logic, music transforms, tool calls  │
└──────────────────┬──────────────────────────────┘
                   │ subprocess (stdin/stdout JSON)
                   ▼
┌─────────────────────────────────────────────────┐
│  Python Engine (src/workers/python/)            │
│  ALL HEAVY COMPUTE LIVES HERE:                  │
│  • Agent ReAct loop + LLM calling + tools       │
│  • Music IR transforms (transpose, motif, etc.) │
│  • MIDI parse/generate                          │
│  • Model inference (Basic Pitch, ACE-Step, etc) │
│  • Audio render (FluidSynth)                    │
│  • Schema validation (Zod-equivalent in Python) │
└─────────────────────────────────────────────────┘
```

## 3. Repository Layout

```text
cc-music/
  src/
    studio-web/              # Frontend: pure UI only
      src/
        app/                 # Shell layout, routing
        components/ui/       # shadcn-ui primitives
        features/
          timeline/          # Konva canvas: section display, bar selection
          piano-roll/        # Konva canvas: note grid, note edit
          inspector/         # Selected object properties
          agent-panel/       # Prompt input, thought log, diff preview
          transport/         # Play/stop/seek, BPM/key display
        stores/              # Zustand (UI state only)
        lib/                 # cn helper, API client
    local-bridge/            # Middleware: thin message router
      src/
        api/                 # Fastify HTTP routes
        projects/            # Project file IO, snapshots, events
        security/            # Origin validation, token
        worker-manager.ts    # Spawn/kill/stream Python subprocess
        server.ts
    workers/
      python/                # ★ THE ENGINE: all compute lives here
        cc_music/
          agent/             # ReAct loop, LLM adapters, tools
          music/             # Music IR transforms, MIDI IO
          models/            # Model inference adapters (post-MVP)
          schema/            # Pydantic schemas (mirror TS Music IR)
          server.py          # stdin/stdout JSON-RPC entry point
        tests/
        pyproject.toml
    packages/
      music-ir/              # TS schemas (shared contract with Python)
      agent-protocol/        # TS stream event types
      test-fixtures/         # JSON fixtures (used by both TS and Python)
    tests/
      e2e/                   # Playwright E2E
  docs/
```

## 4. Technology Choices

### 4.1 Frontend (studio-web)

Pure UI. No business logic, no AI, no music computation.

Use:

- React 19 + TypeScript + Vite.
- Tailwind CSS + CSS variables (design tokens from `docs/uiux.md`).
- shadcn/ui-style local components on Radix UI primitives.
- `lucide-react` for icons.
- Zustand for **UI state only** (selection, zoom, panel sizes, draft prompt). Never canonical project data.
- TanStack Query for bridge API fetch/cache/invalidation.
- Konva/react-konva for timeline and piano-roll canvases.
- Tone.js for **playback only** (transport scheduling, synth presets).
- Playwright for E2E.

Frontend must NOT:
- Run AI/LLM inference.
- Execute music transforms (transpose, motif variation, etc.).
- Parse or generate MIDI files.
- Launch subprocesses or access filesystem.
- Validate schemas beyond form inputs.

Detailed UI/UX rules live in `docs/uiux.md`.

### 4.2 Local Bridge (middleware)

Thin message router between browser and Python engine. No AI logic.

Use:

- Node.js 24 + TypeScript + Fastify.
- Zod for request/response validation at HTTP boundary.
- `better-sqlite3` for project metadata index only (canonical state is files).
- `execa` for Python subprocess management.
- WebSocket for streaming Python events to browser.
- `pino` for structured logging.

Bridge responsibilities:
- Route HTTP requests from browser to Python worker JSON-RPC calls.
- Manage project file IO (atomic writes, snapshots, recovery).
- Spawn Python subprocess, pipe stdin/stdout JSON.
- Stream Python stdout events to browser via WebSocket.
- Validate Origin, enforce local token, bind to 127.0.0.1.
- Redact secrets in logs.

Bridge must NOT:
- Run AI/LLM inference or tool calls.
- Execute music transforms or MIDI generation.
- Parse or generate music data beyond JSON validation.

Same security rules as original (origin validation, atomic writes, per-project locks, process-tree cancellation, log redaction).

### 4.3 Python Engine (workers/python/)

**ALL heavy compute lives here.** This is the real backend.

Use:

- Python 3.12+ with `uv`.
- **Pydantic** for all schemas (mirrors TypeScript Music IR — shared JSON fixtures ensure parity).
- **Hand-written ReAct loop** (~200 lines). No LangChain, no LangGraph.
- **Native LLM function calling** via `httpx` to any OpenAI-compatible endpoint.
- **Adaptable LLM backends**: Claude CLI, Codex CLI, Ollama, vLLM, or any OpenAI-compatible HTTP API.
- `miditoolkit` or `pretty_midi` for MIDI IO.
- `numpy` for music math.
- Post-MVP: `basic-pitch`, `torch`, `demucs`, `fluidsynth`.

Python engine layout:

```
src/workers/python/cc_music/
  agent/
    loop.py            # ReAct loop core
    tools.py            # Tool definitions + dispatch
    adapters/
      mock.py           # Deterministic mock (default tests)
      claude_cli.py     # Claude via local CLI
      openai_compat.py  # Any OpenAI-compatible endpoint
  music/
    ir.py               # Pydantic Music IR models
    transforms.py       # Transpose, motif variation, quantize
    midi_io.py          # MIDI import/export
    validate.py         # Schema + lock validation
  server.py             # stdin/stdout JSON-RPC entry point
```

Bridge ↔ Python protocol (stdin/stdout JSON lines):

```
Bridge → Python:
  {"id":"req_001","method":"agent.run","params":{...}}
  {"id":"req_002","method":"music.transpose","params":{...}}
  {"id":"req_003","method":"midi.export","params":{...}}

Python → Bridge (one JSON per line):
  {"type":"stream_event","data":{...}}    (streaming progress)
  {"type":"result","id":"req_001","data":{...}}  (final)
  {"type":"error","id":"req_001","error":{...}}  (failure)
```

MVP Python dependencies:

```
pydantic
httpx
miditoolkit
numpy
```

Deferred (post-MVP):

```
basic-pitch
torch
demucs
fluidsynth
```

## 5. Music IR

`src/packages/music-ir` owns stored data and cross-boundary schemas.

Required schemas:

- `MusicIrSchema`
- `ProjectManifestSchema`
- `ProjectEventSchema`
- `SectionSchema`
- `TrackSchema`
- `MidiClipSchema`
- `MotifSchema`
- `EditCommandSchema`
- `IrPatchProposalSchema`
- `JobRequestSchema`
- `JobResultSchema`
- `AgentStreamEventSchema`
- `ToolRegistryEntrySchema`

Rules:

- Every persisted project has `schemaVersion`.
- Every AI action creates a snapshot before mutation.
- Every patch validates against schema before preview.
- UI never applies agent text directly.
- Schema changes include fixtures, tests, and migration notes.

## 5.1 Mutation Pipeline

All canonical project mutations use one path:

```text
UI command
  -> EditCommand or IrPatchProposal
  -> schema validation
  -> lock/selection/bar-range validation
  -> preview
  -> snapshot if mutation will apply
  -> apply
  -> persist atomically
  -> append events.ndjson
  -> invalidate/refetch bridge queries
```

Do not add quick-edit shortcuts that bypass this pipeline. Canvas drag, inspector edits, AI patches, MIDI import, undo/redo, and transforms all commit through validated commands.

Project state and render state remain separate:

- `project.json` and snapshots contain canonical Music IR.
- Zustand stores only editor/session state such as selection, zoom, panel sizes, and drafts.
- Canvas/Konva receives derived render arrays and does not own canonical state.

## 6. Timeline Engine

`src/packages/timeline-engine` is pure TypeScript and must not depend on React, Fastify, Tone.js, or local filesystem.

Responsibilities:

- Bar/beat/time conversion.
- Section range math.
- Selection model.
- MIDI clip split/merge.
- Undo/redo command primitives.
- Boundary smoothing for selected-bar regeneration.

Motif transforms, chord-aware note helpers, and all music computation live in the Python engine (`src/workers/python/cc_music/music/`). The timeline-engine provides only bar/beat/time math and selection primitives used by the Konva canvas.

This package is heavily unit tested because it is the product's control layer.

## 7. Agent Protocol (Python Engine)

Agents are assistants, not autonomous mutators. The ReAct loop runs entirely in the **Python engine** as a subprocess; the bridge only routes messages.

### 7.1 Request Flow

```text
Browser prompt
  → bridge POST /api/projects/:id/agent/messages
  → bridge sends JSON-RPC to Python: {"method":"agent.run","params":{...}}
  → Python runs hand-written ReAct loop:
       think → call tool → observe → think → ... → finalize
       (LLM calls any OpenAI-compatible endpoint via httpx)
       (tools are Python functions, read-only or produce intermediate artifacts)
       (each step streams events back via stdout)
  → Python returns IrPatchProposal (JSON)
  → bridge validates + returns to browser
  → UI shows diff preview
  → user applies/rejects
```

### 7.2 Agent Request

```json
{
  "agent": "mock",
  "prompt": "make bars 9-16 a darker electronic variation but preserve motif A",
  "selection": { "barRange": [9, 16], "sectionIds": ["sec_b"], "trackIds": ["track_piano"] },
  "snapshotId": "snap_0004",
  "allowedActions": ["propose_ir_patch", "explain_change"]
}
```

### 7.3 Agent Output

```json
{
  "type": "ir_patch_proposal",
  "summary": "Darker electronic variation preserving motif contour.",
  "patch": [{"op": "replace", "path": "/sections/1/style/genre", "value": "dark minimal electronic"}],
  "musicalDiff": { "barsChanged": [9, 16], "notesAdded": 12, "notesRemoved": 4, "preservedMotifs": ["motif_main"] }
}
```

### 7.4 Hand-Written ReAct Loop

No framework. ~200 lines of Python. Core pattern:

```python
# src/workers/python/cc_music/agent/loop.py

async def react_loop(state: AgentState, tools: list[Tool], llm: LlmBackend) -> AgentResult:
    """Reason + Act loop. Pure Python, no framework."""
    iteration = 0
    while iteration < state.max_iterations:
        # 1. Call LLM with conversation history + tool definitions
        response = await llm.chat(
            system=build_system_prompt(state.snapshot, state.selection),
            messages=state.messages,
            tools=[t.schema() for t in tools],
        )

        # 2. If LLM returns tool calls, execute them
        if response.tool_calls:
            for tc in response.tool_calls:
                result = await dispatch_tool(tc, tools, state)
                state.messages.append(tool_result_message(tc.id, result))
                emit_event("message", summarize(result))

        # 3. If LLM returns a proposal, validate and finalize
        elif response.proposal:
            if validate_patch(response.proposal, state.snapshot):
                emit_event("proposal", response.proposal)
                return AgentResult(success=True, proposal=response.proposal)
            else:
                state.messages.append(validation_feedback())  # retry

        # 4. Otherwise, LLM is still thinking — continue
        else:
            state.messages.append(assistant_message(response.text))
            emit_event("message", response.text)

        iteration += 1

    return AgentResult(success=False, error="max_iterations_exceeded")
```

### 7.5 Agent Tools

Music-domain tools. All Python functions. All read-only or produce temp artifacts.

| Tool | ReadOnly | What It Does |
|---|---|---|
| `read_ir_section` | Yes | Return Music IR for bar range: notes, motifs, chords, style, locks |
| `analyze_motif` | Yes | Pitch contour, rhythm pattern, interval structure, register, density |
| `analyze_chord_progression` | Yes | Identify chords, cadences, map chord tones to scale degrees |
| `generate_motif_variation` | No | New motif variant (transpose, invert, rhythm change) → temp Motif |
| `generate_counter_melody` | No | Counter-melody against existing motif |
| `generate_bassline` | No | Bassline following chord progression |
| `generate_drum_pattern` | No | Rhythm pattern for drum track |
| `validate_patch_schema` | Yes | Pydantic validation of candidate patch |
| `check_lock_violations` | Yes | Verify no section/note locks are violated |
| `build_patch_json` | No | Assemble tool outputs → valid IrPatchProposal |

### 7.6 LLM Backend (Adapter Pattern)

All LLM calls use the same interface, backing is swappable:

```python
class LlmBackend(Protocol):
    async def chat(self, system: str, messages: list, tools: list[dict]) -> LlmResponse: ...

class OpenAiCompatBackend:    # Ollama, vLLM, any /v1/chat/completions endpoint
class ClaudeCliBackend:       # Local `claude --print --output-format stream-json`
class CodexCliBackend:        # Local `codex exec`
class MockBackend:            # Deterministic responses for tests
```

### 7.7 Mock Agent

Deterministic ReAct loop for tests. Matches known prompts to fixed tool sequences + stream events. Supports all failure modes: invalid JSON, schema-invalid patch, timeout, cancelled, max iterations.

### 7.8 Streaming Protocol

Python emits one JSON line per event to stdout:

```json
{"type":"message","data":{"text":"Analyzing bars 9-16..."}}
{"type":"message","data":{"text":"Plan: darken genre, add bassline..."}}
{"type":"message","data":{"text":"Generated variation: 12 notes added."}}
{"type":"proposal","data":{...}}
{"type":"done","data":{}}
{"type":"error","data":{"code":"timeout","message":"..."}}
```

Bridge parses each line, wraps as AgentStreamEvent, and forwards to browser via WebSocket.

- invalid JSON.
- schema-invalid patch.
- timeout.
- cancelled.
- partial stream then error.

## 8. API Surface

MVP API:

```http
GET  /api/system/capabilities
POST /api/projects
GET  /api/projects
GET  /api/projects/:projectId
PUT  /api/projects/:projectId/ir
POST /api/projects/:projectId/snapshots
GET  /api/projects/:projectId/snapshots
GET  /api/projects/:projectId/events
POST /api/projects/:projectId/patches/preview
POST /api/projects/:projectId/patches/apply
POST /api/projects/:projectId/import/midi
GET  /api/projects/:projectId/export/midi
POST /api/projects/:projectId/agent/messages
GET  /api/projects/:projectId/jobs/:jobId
WS   /ws/projects/:projectId/agent/:sessionId
WS   /ws/projects/:projectId/jobs/:jobId
```

Test-only API, enabled only with `CC_MUSIC_TEST_MODE=mocked`:

```http
POST /api/test/reset
POST /api/test/seed-project
```

## 9. Storage

Project folder:

```text
projects/<projectId>/
  manifest.json
  project.json
  snapshots/
    snap_000001.json
    snap_000002.json
  events.ndjson
  exports/
    demo.mid
  assets/
  jobs/
    job_0001.log
```

SQLite stores:

- Project index.
- Snapshot metadata.
- Job status.
- Agent session metadata.
- Capability checks.

The canonical project state remains `project.json` plus snapshots so users can inspect and version files.

File contract:

- `manifest.json`: project id, title, schema version, app version, created/updated timestamps, optional future owner/team fields.
- `project.json`: canonical Music IR only.
- `snapshots/*.json`: immutable snapshot payloads, named monotonically.
- `events.ndjson`: append-only audit events.
- `exports/`: generated `.mid` files for MVP.
- `assets/`: empty or placeholder in MVP; no audio asset workflow is required.
- `jobs/`: redacted logs and artifact manifests only.

Local audit events:

```json
{
  "eventId": "evt_000001",
  "projectId": "demo",
  "actor": { "type": "local_user" },
  "type": "patch_applied",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "payload": {
    "snapshotId": "snap_000004",
    "patchId": "patch_0001"
  }
}
```

MVP event types:

- `project_created`
- `project_opened`
- `project_saved`
- `patch_proposed`
- `patch_previewed`
- `patch_applied`
- `patch_rejected`
- `undo`
- `redo`
- `midi_imported`
- `midi_exported`
- `capability_checked`
- `adapter_failed`

Crash recovery:

- Write `project.json.tmp`, fsync where practical, then rename to `project.json`.
- On startup, delete stale temp files only after validating they are inside the project root.
- If `project.json` is invalid, recover from the latest valid snapshot and append a recovery event.
- If SQLite metadata disagrees with project files, project files win; rebuild metadata from manifest, snapshots, events, and jobs.
- Keep a dirty flag in memory/UI for unsaved edits; do not invent cloud sync or collaboration conflict handling in MVP.

## 10. Job Model

All async work uses the same state machine:

```text
queued -> running -> succeeded
                  -> failed
                  -> cancelled
```

Job event:

```json
{
  "jobId": "job_001",
  "type": "agent_ir_patch",
  "status": "running",
  "progress": 0.45,
  "message": "Validating patch",
  "timestamp": "2026-05-21T10:00:00.000Z"
}
```

MVP job types:

- `agent_ir_patch`
- `midi_import`
- `midi_export`
- `mock_render_preview`

Post-MVP job types:

- `audio_to_midi_basic_pitch`
- `fluid_synth_render`
- `image_to_music_brief`
- `acestep_generate`
- `acestep_repaint`
- `demucs_separate`

## 11. UI Architecture

Screen layout:

```text
Top bar:
  project, save state, BPM, key, transport, export

Left rail:
  motifs, tracks, assets, import

Center:
  timeline
  piano-roll / arrangement tabs

Right inspector:
  selection, section, motif, locks, generation controls

Bottom:
  agent panel, job queue, version history
```

Feature boundaries:

- `timeline`: visual section/bar selection and clip blocks.
- `piano-roll`: note editing and motif editing.
- `inspector`: selected object properties and locks.
- `agent-panel`: prompt, stream, proposal summary, diff apply/reject.
- `version-history`: snapshots, undo/redo, revert.
- `transport`: playback state and tempo/key display.

Important UI rule:

```text
Canvas displays state. It does not own canonical state.
```

All canonical data lives in stores loaded from validated Music IR.

## 12. Playback

MVP playback:

- Use Tone.Transport for scheduling.
- Use Tone.Sampler or simple synth presets.
- Project state controls tempo/time signature.
- MIDI notes are scheduled from Music IR clips.

Do not block MVP on:

- sample-perfect offline rendering.
- VST hosting.
- advanced effects.
- high quality piano libraries.
- multi-device MIDI IO.

## 13. Playwright E2E

Playwright starts both frontend and bridge via `webServer` config.

Required environment:

```text
CC_MUSIC_TEST_MODE=mocked
CC_MUSIC_PROJECT_ROOT=<temp-dir>
CC_MUSIC_AGENT_ADAPTER=mock
CC_MUSIC_WORKERS=mock
```

Playwright must use a fixed temporary project root per test run. It must never read or mutate the developer's real project directory.

Required specs:

- app smoke.
- project create/save/load.
- timeline selection.
- piano-roll note edit.
- agent patch preview/apply/reject.
- MIDI import/export round trip.
- version history undo/redo.

Canvas-heavy features require:

- DOM size assertions.
- nonblank canvas pixel checks.
- selected-region pixel checks.
- stable screenshots with animations disabled.

Mocking rule:

- Browser-side Playwright route mocks are not allowed for agent/worker behavior.
- Tests must exercise the local bridge code path with mock adapters enabled.
- Real Codex, Claude, ffmpeg, Basic Pitch, ACE-Step, GPU, and network are excluded from default E2E.

Playwright references:

- `webServer`: https://playwright.dev/docs/test-webserver
- visual comparisons: https://playwright.dev/docs/test-snapshots
- screenshots API: https://playwright.dev/docs/screenshots

## 14. Security Boundaries

- Browser never launches commands.
- Local bridge only runs allowlisted subprocess adapters.
- Subprocess cwd is restricted to workspace/project directories.
- Destructive operations require explicit user confirmation.
- Real external tools are optional capabilities.
- Logs redact tokens, API keys, auth files, and absolute secret paths.
- Test mode cannot access real user project directories.
- Agent outputs are proposals until validated and accepted.

## 15. Capability Detection

`GET /api/system/capabilities` reports:

```json
{
  "codex": { "available": true, "mode": "exec" },
  "claude": { "available": true, "mode": "print-stream-json" },
  "ffmpeg": { "available": false },
  "basicPitch": { "available": false },
  "fluidSynth": { "available": false },
  "aceStep": { "available": false }
}
```

Missing capabilities do not break MVP. They hide optional buttons and keep mocks available for tests.

Capability gating rules:

- Unavailable capabilities hide or disable related actions.
- Disabled actions explain the missing local dependency.
- Default tests use mock capabilities.
- Real adapters are never required for MVP acceptance.
- Capability checks append `capability_checked` events when project-scoped.

Minimal tool/model registry:

```json
{
  "id": "mock-agent",
  "displayName": "Mock Agent",
  "kind": "agent",
  "enabledByDefault": true,
  "capabilityRequirement": "mock",
  "license": "project",
  "commercialAllowed": true,
  "requiresNetwork": false,
  "requiresGpu": false,
  "testModeBehavior": "deterministic-fixture"
}
```

Registry fields:

- `id`
- `displayName`
- `kind`: `agent`, `midi_transform`, `audio_render`, `audio_to_midi`, `image_to_brief`, `text_to_midi`
- `enabledByDefault`
- `capabilityRequirement`
- `license`
- `weightsLicense`
- `commercialAllowed`
- `requiresNetwork`
- `requiresGpu`
- `inputContract`
- `outputContract`
- `testModeBehavior`

MVP has a registry file/schema but no model marketplace, downloader, installer, or model-management UI.

## 16. Architecture Risks

| Risk | Mitigation |
|---|---|
| Scope expands into full DAW | Product law: MIDI sketch editor first, export to DAW |
| Agent returns unreliable output | JSON schema, mock tests, diff preview, no direct mutation |
| Canvas UI becomes untestable | Playwright pixel helpers and stable test fixtures |
| Open-source license contamination | Model registry and dependency license review before bundling |
| Heavy local tools make setup brittle | Mock-first, capability-gated adapters |
| Music IR becomes too abstract | Keep only fields needed for current editor operations |
| React state diverges from project file | All mutations go through schema-validated command pipeline |

## 17. Non-MVP Extension Architecture

When the MIDI editor is stable, optional adapters plug into the job system:

```text
Basic Pitch:
  audio file -> MIDI motif candidate -> user trims/quantizes -> motif

Image brief:
  image -> local VLM/OpenCLIP -> music brief -> EditCommand

FluidSynth:
  Music IR/MIDI -> SoundFont render -> WAV preview/export

ACE-Step:
  Music IR summary + optional rendered guide -> audio draft/repaint

Demucs:
  audio file -> stems -> optional Basic Pitch per stem
```

All adapters must:

- have mock fixtures first.
- implement typed job contracts.
- be capability-gated.
- be optional in CI.
- record license and commercial-use status in model/tool registry.

## 18. Frontend Performance Standard

The editor must feel immediate even before heavy models exist.

Rules:

- Canvas surfaces own rendering, not canonical state.
- Music IR lives in validated project/query state.
- Zustand stores only editor/session state and selected IDs/ranges.
- Use selectors so selection/playhead changes do not re-render the full app.
- Do not update React state on every audio tick.
- Draw playhead through refs/requestAnimationFrame and throttle inspector updates.
- Memoize derived canvas render data.
- Split Konva layers into grid, clips/notes, selection/preview, playhead.
- Batch drag updates and commit canonical mutations on drag end unless live mutation is required.
- Use stable dimensions for timeline, piano roll, toolbar buttons, and panels.
- Use Playwright canvas pixel checks for timeline and piano roll.

Default state split:

```text
TanStack Query:
  project manifest
  Music IR
  snapshots
  jobs
  capabilities

Zustand:
  selected bars/sections/tracks/notes
  editor tab
  zoom/scroll
  panel sizes
  agent draft UI
  transport UI state

Refs/services:
  Tone.js transport
  audio nodes
  animation frame playhead
```

## 19. Backend Performance Standard

The local bridge should stay boring and fast.

Rules:

- Keep Fastify plugins minimal.
- Keep API handlers thin: validate -> service -> typed response.
- Use `app.inject()` tests for backend routes.
- Keep SQLite writes short and explicit.
- Store large assets as files, not SQLite blobs.
- Stream agent/job events; do not poll.
- Use backpressure-aware streams for logs/output.
- Limit concurrent jobs globally and per project.
- Cache capability detection for a short TTL.
- Never block MVP on GPU/model startup.

Suggested job limits:

```text
project mutation queue: concurrency 1 per project
agent jobs: concurrency 1 per project
light MIDI jobs: concurrency 2-4 globally
heavy post-MVP model jobs: concurrency 1 globally by default
```

## 20. Security Standard

Threat model:

- A malicious web page tries to call the local bridge.
- An agent emits dangerous commands or malformed patches.
- A file upload tries path traversal or zip-like expansion later.
- A worker tries to read/write outside the project.
- Logs accidentally leak local tokens.

Required controls:

- Loopback bind by default.
- Exact Origin allowlist.
- Reject `Origin: null` and absent browser Origin.
- Random local session token in explicit HTTP/WS header.
- No wildcard CORS.
- DNS rebinding defense through exact allowed origins and random token.
- Schema validation at every boundary.
- No shell execution.
- Resolved executable allowlist.
- Adapter-owned argument arrays.
- Minimal subprocess env allowlist.
- Output byte limits and log truncation.
- Kill process tree on timeout/cancel.
- Path realpath containment checks.
- Per-project root enforcement.
- Upload size limits.
- Snapshot before mutation.
- Proposal-only agent output.
- Redacted logs.
- Mock-only CI.
- Test routes enabled only in mocked mode with a temp project root.

Telemetry:

- No telemetry by default.
- MVP supports local diagnostics logs only.
- Future telemetry must be explicit opt-in.
- Logs redact prompts, project paths, local auth files, tokens, API keys, and command environments.

## 21. License Decision

Recommended project license:

```text
AGPL-3.0-or-later for the application and local bridge.
```

Why:

- The product is intended to be open-source.
- A local-first AI studio can otherwise be trivially hosted or wrapped without contributing changes.
- AGPL protects server/hosted modifications if a cloud version appears later.

Practical notes:

- Keep third-party dependencies under their own upstream licenses.
- Do not copy GPL/AGPL code from reference projects into the repo unless the licensing impact is accepted.
- Permissive dependencies like MIT, BSD-3-Clause, Apache-2.0, and ISC are acceptable.
- LGPL dependencies such as FluidSynth require compliance review, especially if statically linked or shipped as WASM.
- Noncommercial model weights must not be part of the default commercial-safe core.
- Root `package.json` uses `AGPL-3.0-or-later`.
- Add SPDX header policy or a repo-level statement before broad external contributions.
- Add `THIRD_PARTY_NOTICES.md` before first release.
- Add dependency license audit in CI before first release.
- Add UI-accessible Source / License / No Warranty notice before hosted or packaged distribution.
- If future commercial embedding is needed, use dual licensing with contributor agreement before accepting broad external contributions.

## 22. Initial Dependency Baseline

These are the dependencies Claude Code should start with. Additions require a parent decision.

Frontend app dependencies:

```text
@vitejs/plugin-react
vite
typescript
react
react-dom
tailwindcss
postcss
autoprefixer
lucide-react
@radix-ui/react-dialog
@radix-ui/react-dropdown-menu
@radix-ui/react-popover
@radix-ui/react-select
@radix-ui/react-slider
@radix-ui/react-tabs
@radix-ui/react-tooltip
@radix-ui/react-toggle
@radix-ui/react-toggle-group
class-variance-authority
clsx
tailwind-merge
zustand
@tanstack/react-query
react-hook-form
@hookform/resolvers
zod
konva
react-konva
tone
@tonejs/midi
```

Backend app dependencies:

```text
fastify
@fastify/websocket
fastify-type-provider-zod
zod
better-sqlite3
execa
p-queue
nanoid
```

Python engine dependencies (pyproject.toml):

```text
pydantic
httpx
miditoolkit
numpy
```

Defer until needed:

```text
wavesurfer.js
react-resizable-panels
immer
fast-json-patch
node-pty
ffmpeg wrappers
basic-pitch
torch
demucs
fluidsynth bindings
ACE-Step / model weights
```

Test/dev dependencies:

```text
vitest
@playwright/test
tsx
eslint
prettier
typescript-eslint
```

Defer until needed:

```text
wavesurfer.js
react-resizable-panels
immer
fast-json-patch
node-pty
ffmpeg wrappers
Python worker dependencies
ACE-Step / Basic Pitch / Demucs packages
```

Dependency rules:

- Prefer one dependency for one job.
- Do not add Redux, MobX, XState, Next.js, Electron, Tauri, Prisma, or NestJS in MVP.
- Do not add a UI component framework like MUI, Ant Design, Chakra, or Mantine.
- Do not add full DAW/audio engines beyond Tone.js for MVP.

## 23. Reference Projects

Local shallow clones live in:

```text
docs/reference-projects/
```

They are ignored by `docs/reference-projects/.gitignore` and should not be committed as vendored source.

Use them this way:

- `tonejs-tonejs`: playback/transport architecture.
- `tonejs-midi`: MIDI import/export.
- `wavesurfer-js`: later waveform regions.
- `konva`: canvas rendering/interaction.
- `radix-primitives`: accessible primitive patterns.
- `shadcn-ui`: local component style.
- `lucide`: icon set.
- `zustand`: state management patterns.
- `fastify`: plugin/server patterns.
- `basic-pitch`: post-MVP audio-to-MIDI adapter.
- `waveform-playlist`: multitrack WebAudio editor reference.
- `ace-step-ui` and `ace-step-1.5`: post-MVP audio generation references.

Additional watchlist references:

- Producer Pal: agent-controlled Ableton MCP/REST/Skill UX reference; GPL-3.0, study but do not copy into core without review.
- DAWZY: reversible natural-language DAW edit research reference.
- claw-daw: deterministic, scriptable, diffable agent music workflow reference.
- DAWproject: MIT DAW interchange format for post-MVP structured export.
- MusPy: MIT symbolic music toolkit for Python worker research/evaluation.
- Text2midi: optional text-to-MIDI worker candidate; review model/license before use.
- MIDI-LLM: optional external adapter candidate; do not bundle Llama-family weights into default core.
- Web Audio Modules 2.0: future plugin architecture reference, not MVP.
