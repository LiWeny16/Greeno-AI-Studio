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

```text
Browser UI
  React / TS / Vite
  Timeline, piano roll, inspector, agent panel
  Tone.js playback
  @tonejs/midi import/export
  Konva canvas surfaces

Local Bridge
  Node / TS / Fastify
  Project IO
  Agent adapters
  Job queue
  Worker subprocess manager
  WebSocket event streams

Shared Packages
  music-ir
  timeline-engine
  agent-protocol
  test-fixtures

Workers
  MVP mock workers
  Optional Python workers later
  Optional heavy model adapters later

Local Project Store
  SQLite metadata
  manifest.json
  project.json
  JSON snapshots
  events.ndjson
  MIDI exports
  Rendered assets
```

## 3. Repository Layout

```text
cc-music/
  src/
    studio-web/
      src/
        app/
        components/
        features/
        lib/
        stores/
        testids.ts
    local-bridge/
      src/
        api/
        agent/
        jobs/
        projects/
        security/
        workers/
        server.ts
    packages/
      music-ir/
      timeline-engine/
      agent-protocol/
      tool-registry/
      test-fixtures/
    tests/
      e2e/
        app-smoke.spec.ts
        helpers/
    workers/
      python/
        pyproject.toml
        README.md
  docs/
    plan.md
    path.md
    arch.md
    ownership.md
  .github/
    workflows/
  CLAUDE.md
  AGENTS.md
```

## 4. Technology Choices

### 4.1 Frontend

Use:

- React 19 + TypeScript + Vite.
- Tailwind CSS for layout and design tokens.
- shadcn/ui component style with local components under `components/ui`.
- Radix UI primitives for accessible menus, dialogs, tabs, tooltips, popovers, and toggles.
- `lucide-react` for all normal UI icons.
- Zustand for local editor/session state.
- TanStack Query for local bridge API state.
- React Hook Form + Zod resolver for forms.
- Konva/react-konva for timeline and piano-roll canvases.
- Tone.js for playback transport, scheduling, synths, and samplers.
- `@tonejs/midi` for MIDI import/export.
- Playwright for E2E, screenshots, and canvas checks.

Do not build from scratch:

- MIDI parser/writer.
- WebAudio transport/scheduling.
- Canvas event scene graph.
- Waveform region renderer once audio clips enter the product.
- Dialog/select/menu/tooltip primitives.
- Icon set.

Detailed UI/UX rules live in `docs/uiux.md`.

### 4.2 Local Bridge

Use:

- Node.js 24 Active LTS preferred; Node.js 22 Maintenance LTS supported while dependency compatibility requires it.
- TypeScript.
- Fastify HTTP API.
- WebSocket for stream events.
- Zod for all request/response/worker/agent validation.
- `fastify-type-provider-zod` or equivalent thin Zod integration.
- `@fastify/websocket` for agent/job streams.
- `@fastify/static` only if the packaged app serves frontend assets from the bridge.
- `@fastify/multipart` only when file upload is implemented.
- SQLite through `better-sqlite3` for project index, job metadata, snapshots, capability cache.
- `pino` logging through Fastify.
- `execa` for subprocess adapters using argument arrays, not shell strings.
- `p-queue` or a tiny equivalent queue for job concurrency and per-project write serialization.
- Filesystem for project data, exported MIDI, and generated assets.
- `node-pty` only if an interactive terminal stream is truly required later.

The bridge is the only process allowed to:

- Read/write project files.
- Launch Codex/Claude.
- Launch Python/model/ffmpeg workers.
- Manage job cancellation and logs.

Backend implementation rules:

- Bind to `127.0.0.1` by default, not `0.0.0.0`.
- Validate Origin and require a local session token for browser-to-bridge calls in dev.
- Reject `Origin: null`, absent browser Origin, wildcard CORS, and broad localhost trust.
- Require the local token in an explicit HTTP/WS header, not only cookies.
- Validate WebSocket Origin and token exactly like HTTP.
- Use Vite proxy in development so the browser does not need broad CORS.
- Use atomic file writes: write temp file, fsync where practical, rename.
- Resolve and verify real paths before any project file read/write.
- Reject symlinks that escape the project root.
- Use per-project write locks to prevent snapshot/project corruption.
- Never run subprocess commands through a shell.
- Resolve subprocess executable paths and run only allowlisted binaries.
- Use adapter-owned argument arrays; user text enters through stdin or validated temp files.
- Pass a minimal environment allowlist to subprocesses instead of inheriting all of `process.env`.
- Limit stdout/stderr bytes and truncate logs.
- Kill the process tree on timeout or cancellation.
- Set timeouts and cancellation signals for every subprocess.
- Redact tokens, home auth paths, API keys, and command env values from logs.
- Keep test routes disabled unless `CC_MUSIC_TEST_MODE=mocked` and `CC_MUSIC_PROJECT_ROOT` is a temp path.
- Do not use `node-pty` until an explicit threat model is written.

### 4.3 Workers

MVP workers are deterministic TypeScript modules. Real external tools are added later behind the same contracts.

Worker levels:

```text
mock
  CI/default. No external dependencies.

local-light
  Node/TS only. MIDI transforms, fixture generation, simple playback metadata.

local-python
  Basic Pitch, FluidSynth/ffmpeg, analysis scripts.

local-heavy
  ACE-Step, Demucs, image/VLM adapters.
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
- Motif transforms.
- Chord-aware note helpers.
- MIDI clip split/merge.
- Undo/redo command primitives.
- Boundary smoothing for selected-bar regeneration.

This package is heavily unit tested because it is the product's control layer.

## 7. Agent Protocol

Agents are implementation assistants, not autonomous file mutators.

The adapter runs a **ReAct loop** (Reason + Act) orchestrated by **LangGraph**, but the external contract stays the same: one AgentRequest in, one IrPatchProposal out, user approves before any mutation.

### 7.1 Request Flow

```text
User prompt
  -> studio-web sends AgentRequest
  -> local-bridge loads project snapshot
  -> local-bridge builds structured system prompt with Music IR context
  -> adapter runs LangGraph ReAct loop (internal, multi-step):
       ┌─────────────────────────────────────────────────┐
       │  AnalyzeRequest → Plan → ToolCall → Observe →   │
       │  GeneratePatch → SelfValidate → RefineOrFinalize │
       └─────────────────────────────────────────────────┘
       Each thought/action/observation emitted as AgentStreamEvent
  -> adapter returns IrPatchProposal
  -> Zod validation
  -> UI diff preview
  -> user applies/rejects
```

The ReAct loop is an **adapter-internal implementation detail**. The external API surface (AgentRequest → AgentStreamEvents → IrPatchProposal) is unchanged. The agent cannot write to project files; tools are read-only or produce intermediate artifacts.

### 7.2 Agent Request

```json
{
  "agent": "mock",
  "mode": "ir_patch",
  "prompt": "make bars 9-16 a darker electronic variation but preserve motif A",
  "selection": {
    "barRange": [9, 16],
    "sectionIds": ["sec_b"],
    "trackIds": ["track_piano"]
  },
  "snapshotId": "snap_0004",
  "allowedActions": [
    "propose_ir_patch",
    "explain_change"
  ]
}
```

### 7.3 Agent Output

```json
{
  "type": "ir_patch_proposal",
  "summary": "Create a darker higher-energy variation while keeping motif contour.",
  "patch": [
    {
      "op": "replace",
      "path": "/sections/1/style/genre",
      "value": "dark minimal electronic"
    }
  ],
  "musicalDiff": {
    "barsChanged": [9, 16],
    "notesAdded": 12,
    "notesRemoved": 4,
    "preservedMotifs": ["motif_main"]
  }
}
```

### 7.4 LangGraph ReAct Loop Architecture

The agent adapter uses **LangGraph** (TypeScript, `@langchain/langgraph`) to orchestrate a stateful ReAct loop. The graph is a directed state machine with conditional edges. The loop runs entirely inside the bridge process — the browser only sees stream events and the final proposal.

#### 7.4.1 Agent State

```typescript
interface AgentState {
  // Immutable context
  projectSnapshot: MusicIr;
  userPrompt: string;
  selection: AgentSelection;
  
  // ReAct loop state
  messages: BaseMessage[];        // LLM conversation history
  currentStep: string;            // current graph node name
  iterationCount: number;         // safety limit
  
  // Intermediate artifacts
  analysis?: MusicAnalysis;       // structured analysis of target bars
  plan?: EditPlan;                // sequence of intended edits
  intermediatePatch?: IrPatchProposal;  // draft patch (may be refined)
  
  // Terminal output
  finalProposal?: IrPatchProposal;
  error?: AgentError;
}
```

#### 7.4.2 Graph Nodes

```text
                    ┌──────────┐
                    │  START   │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ ANALYZE  │ ← LLM: analyze selection, identify patterns
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  PLAN    │ ← LLM: decide which edit tools to call
                    └────┬─────┘
                         │
              ┌──────────▼──────────┐
              │    TOOL_EXECUTE     │ ← Execute tool calls, collect results
              └──────────┬──────────┘
                         │
                    ┌────▼─────┐
                    │ OBSERVE  │ ← LLM: interpret tool results, decide next action
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         need_more    confident   max_iter
              │          │          │
              ▼          ▼          ▼
         back to    GENERATE_PATCH  │
         PLAN       │               │
                    ▼               ▼
              SELF_VALIDATE    FINALIZE_ERROR
                    │
              ┌─────┼─────┐
              │           │
          passes       fails
              │           │
              ▼           ▼
         FINALIZE    back to PLAN
              │       (with validation errors)
              ▼
           END
```

**Nodes:**

| Node | Role | LLM? | Tools? |
|---|---|---|---|
| `ANALYZE` | Examine selected bars: motifs, chords, rhythm patterns, energy curve | Yes | `read_ir_section`, `analyze_motif` |
| `PLAN` | Decide which edits to make, in what order | Yes | None (reasoning only) |
| `TOOL_EXECUTE` | Run planned tool calls deterministically | No | All registered tools |
| `OBSERVE` | Feed tool results back to LLM, decide: continue refining or proceed? | Yes | None (reasoning only) |
| `GENERATE_PATCH` | Convert plan + tool results into structured `IrPatchProposal` JSON | Yes | `build_patch_json` (non-LLM post-process) |
| `SELF_VALIDATE` | Validate generated patch against schema, locks, and musical constraints | No | `validate_patch_schema`, `check_lock_violations` |
| `FINALIZE` | Emit final proposal stream event, return result | No | None |
| `FINALIZE_ERROR` | Emit structured error with diagnostics | No | None |

#### 7.4.3 Safety Limits

- `maxIterations`: 10 (configurable). Exceeding returns partial result + error.
- `maxToolCallsPerStep`: 5.
- `maxLLMTokensPerCall`: 4096 input, 2048 output.
- `timeoutMs`: 30000 default (MVP), 120000 for complex sessions.

#### 7.4.4 Streaming to UI

Each node transition emits an `AgentStreamEvent`:

```json
{"type": "started", "requestId": "req_001", "timestamp": "..."}
{"type": "message", "requestId": "req_001", "message": "Analyzing bars 9-16: found motif_main (A4-C5-E5-D5 pattern), energy 0.35, genre 'minimal piano'"}
{"type": "message", "requestId": "req_001", "message": "Plan: darken genre, raise energy to 0.65, add bassline, preserve motif contour"}
{"type": "message", "requestId": "req_001", "message": "Generated variation: added bass D3-F3-G3, replaced piano with dark pad, velocity +0.15"}
{"type": "message", "requestId": "req_001", "message": "Self-validation: patch valid, no lock violations, 12 notes added, 0 removed"}
{"type": "proposal", "requestId": "req_001", "proposal": { ... }}
{"type": "completed", "requestId": "req_001", "timestamp": "..."}
```

UI renders `message` events as a streaming thought log so the user sees the agent's reasoning.

### 7.5 Agent Tools (Function Calling)

Tools are music-domain-specific functions the LLM can invoke during the ReAct loop. All tools are **read-only or produce intermediate artifacts** — none can write to project files.

#### 7.5.1 Tool Registry

```typescript
interface AgentTool {
  name: string;
  description: string;           // LLM-readable description for function calling
  parameters: ZodSchema;         // JSON Schema for LLM function call args
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
  readOnly: boolean;             // true = no side effects, false = produces artifact
}

interface ToolContext {
  projectSnapshot: MusicIr;
  selection: AgentSelection;
  workingDir: string;            // temp dir for intermediate artifacts
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  artifacts?: string[];          // paths to generated files (MIDI previews, etc.)
}
```

#### 7.5.2 MVP Tool Set

| Tool | ReadOnly | Description |
|---|---|---|
| `read_ir_section` | Yes | Return full Music IR for a bar range or section: notes, motifs, chords, style, locks |
| `analyze_motif` | Yes | Extract motif properties: pitch contour, rhythm pattern, interval structure, register |
| `analyze_chord_progression` | Yes | Identify chord progression in a section, detect cadences |
| `generate_motif_variation` | No | Create a new motif variant (transpose, invert, rhythm change, etc.) — returns a Motif candidate, does NOT write to project |
| `generate_counter_melody` | No | Create a counter-melody line against an existing motif |
| `generate_bassline` | No | Create a bassline following the chord progression |
| `generate_drum_pattern` | No | Create a rhythm pattern for a drum track |
| `validate_patch_schema` | Yes | Run Zod validation on a candidate patch, return errors if any |
| `check_lock_violations` | Yes | Verify a candidate patch does not violate section/note locks |
| `build_patch_json` | No | Assemble tool outputs into a properly formatted `IrPatchProposal` |
| `render_preview_midi` | No | Synthesize candidate notes to a temp MIDI file for reference (lightweight, mock in tests) |

#### 7.5.3 Tool Execution Model

Tools run as **subprocess calls** on the bridge, same as other workers. Each tool gets:
- Typed input (Zod-validated)
- Sandboxed working directory (temp, cleaned up after session)
- Byte-limited output
- Timeout (10s default for analysis tools, 30s for generation tools)

The LLM sees tool definitions as JSON Schema function declarations and can request tool calls as part of its response. The `TOOL_EXECUTE` node dispatches calls, collects results, and feeds them back in the next LLM turn.

### 7.6 LangGraph Implementation

Use `@langchain/langgraph` (TypeScript) with `@langchain/anthropic` for Claude or `@langchain/openai` for Codex as the LLM backend.

```
src/local-bridge/src/agent/
  graph.ts              — LangGraph state machine definition (nodes + edges)
  state.ts              — AgentState type + initial state factory
  tools/
    index.ts            — tool registry + dispatch
    read-ir.ts          — read_ir_section, analyze_motif, analyze_chord_progression
    generate.ts         — generate_motif_variation, generate_counter_melody, etc.
    validate.ts         — validate_patch_schema, check_lock_violations
    build-patch.ts      — build_patch_json, render_preview_midi
  adapters/
    mock.ts             — deterministic mock agent (no LLM, fixed tool outputs)
    claude.ts           — Claude adapter (LangChain Anthropic backend)
    codex.ts            — Codex adapter (LangChain OpenAI-compatible backend)
```

### 7.7 Mock Agent (ReAct Mode)

The mock agent simulates a ReAct loop without requiring an LLM:

- Matches known prompt patterns to deterministic tool call sequences
- Returns pre-defined `AgentStreamEvent` sequences (analyze → plan → generate → validate → finalize)
- Supports failure fixtures: invalid tool output, schema-invalid patch, timeout, max iterations exceeded
- Verifies that the graph itself executes correctly

### 7.8 Local Claude Adapter

Local command supports:

```text
claude --print
claude --output-format stream-json
claude --json-schema <schema>
```

Adapter responsibilities:
- Wrap Claude in a LangGraph-compatible LLM interface
- Pass tool definitions as function calling schema
- Parse Claude's tool call requests into `TOOL_EXECUTE` dispatch
- Stream Claude's thinking as `AgentStreamEvent` messages
- Fall back to `--print --output-format stream-json` if LangGraph is not available

### 7.9 Local Codex Adapter

Local command:

```text
codex exec
```

Adapter responsibilities:
- Same LangGraph integration as Claude adapter
- Use OpenAI-compatible function calling for tools
- Force JSON output mode for structured responses
- Reject non-schema output as adapter failure

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
@fastify/static
@fastify/multipart
fastify-type-provider-zod
zod
better-sqlite3
execa
p-queue
nanoid
@langchain/langgraph
@langchain/core
@langchain/anthropic
@langchain/openai
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
