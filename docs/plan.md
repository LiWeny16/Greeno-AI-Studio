# CC Music AI Studio MVP Plan

Last updated: 2026-05-21

## 1. Positioning

CC Music is a local-first, open-source AI MIDI editor for structured composition.

The product should not compete with Suno, Udio, Mureka, or ACE-Step UIs on finished full-song audio. The wedge is narrower:

> AI that edits the song structure you can see and control: bars, sections, motifs, chords, and tracks.

The MVP is for creators who need controllable instrumental sketches, especially game BGM, short-video BGM, electronic loops, and piano/electronic composition drafts. The first release should prove that a user can create a 32-bar MIDI sketch, vary selected bars, preview diffs, undo, and export MIDI to a real DAW.

## 2. Strict MVP

Build only this first:

1. Local project model
   - Tracks, bars, sections, motifs, tempo, key, chords.
   - Music IR is the canonical source of truth; MIDI is the editable interchange/export surface.
   - Save/open local project folders with a strict file contract.
   - Append local audit events for project, patch, undo, import, export, and adapter failures.

2. Arrangement editor
   - Timeline with bars and labeled sections.
   - Motif blocks that can be duplicated, varied, muted, moved, or regenerated.
   - Selected bars/sections are the target for every AI operation.

3. Basic MIDI editing
   - Piano roll or grid editor.
   - Quantize, transpose, velocity, length, copy/paste, undo/redo.
   - Import/export `.mid`.

4. Playback
   - Browser playback through WebAudio/SoundFont/Tone.js.
   - Basic preview quality is enough.
   - Offline by default after setup.

5. AI assistant as implementation layer
   - User says: "make bars 9-16 a higher-energy variation of motif A."
   - Assistant converts the request into visible, reversible MIDI edits.
   - Every AI action creates a diff/preview before Apply.
   - Assistant can operate on bars, sections, motifs, chords, rhythm density, register, velocity, and instrumentation labels.

6. Generation boundary
   - Generate short MIDI ideas only: 1-8 bars.
   - Variation, continuation, reharmonization, bassline, countermelody, simple drum pattern.
   - No full-song audio generation in the MVP.

7. Guardrail boundary
   - Before feature work, the repo must have executable guardrails: workspace scaffold, schemas, mocks, tests, Playwright, CI, and subagent ownership table.
   - No UI-heavy or real-adapter work starts until `pnpm typecheck`, `pnpm test`, and mocked Playwright smoke are defined and runnable.

## 3. Do Not Build In MVP

- Full-song audio generation.
- Vocals, lyrics-to-song, voice cloning, stem separation.
- Audio inpainting or ACE-Step repaint.
- Mastering, mixing, effects chains, VST hosting.
- Marketplace, social sharing, publishing, collaboration.
- Mobile app.
- ComfyUI-style node editor.
- Full DAW replacement.
- Model training or LoRA workflows.
- Advanced notation editor.
- Cloud accounts, subscriptions, or hosted generation as default.
- RBAC, SSO, organizations, admin console, compliance dashboard.
- Rich model marketplace/downloader UI.
- External plugin SDK or user-installed plugin ecosystem.
- Product analytics, session replay, or telemetry upload.

These can become optional adapters later, but they must not block the first controllable MIDI loop.

## 4. Success Metrics

- User can create a structured 32-bar MIDI sketch in under 10 minutes.
- AI edit preview appears in under 3 seconds for typical 4-8 bar edits.
- At least 80% of AI edits are accepted or manually adjusted, not discarded.
- MIDI import/export round trip preserves notes, tempo, bars, and track names.
- Undo/redo works for 100% of AI actions.
- Project can be used fully offline after setup.
- First demo proves: create motif, vary it, arrange sections, export MIDI to a DAW.
- Project save/load survives bridge restart and can recover from latest valid snapshot if `project.json` is corrupt.
- Default telemetry is none; only local redacted diagnostics logs exist in MVP.

## 5. Competitor Map

| Category | What They Own | Gap To Exploit |
|---|---|---|
| Suno / Udio / Mureka | Cloud full-song generation, audio inpainting, stems, timeline workflows, vocals, references | Not local/open; limited deterministic MIDI/bar/motif control; output-first rather than composition-first |
| ACE-Step / ACE-Step UI / Majik Studio | Local/open text-to-music generation, Suno-like workflows, reference/repaint/audio flows | Mostly prompt-to-audio; weak structured composition editing |
| ComfyUI + ACE-Step nodes | Powerful graph experimentation for audio generation workflows | Too technical for composers; graph is not a musical editor |
| Magenta Studio | MIDI-first generative clip tools inside Ableton | Old/narrow; not a standalone structured AI editor |
| Calliope / midi-gen | Symbolic MIDI generation and piano-roll interaction | Research/prototype feel; incomplete product workflow |
| DAWZY / REAPER agents | Natural-language control of a real DAW with reversible actions | Depends on REAPER; not a new local-first composition surface |
| Producer Pal / Ableton MCP tools | Agent-controlled DAW through MCP/REST/skills | Excellent agent UX reference, but depends on Ableton and mutates live DAW state |
| Text2midi / MIDI-LLM | Text-to-MIDI symbolic generation | Useful future workers; too model-output-first for the MVP edit loop |

Conclusion: there is no perfect open-source competitor for "local-first MIDI-native AI editor with bar/section/motif diffs." Existing projects provide reusable parts, not the whole product.

## 6. Reuse-First Open Source Strategy

Do not build these from scratch:

| Need | Reuse | License / Risk | MVP Decision |
|---|---|---|---|
| MIDI parsing/export | `@tonejs/midi` | MIT | Use immediately |
| Browser playback/scheduling | Tone.js | MIT | Use immediately |
| Canvas editor surface | Konva / react-konva | MIT | Use for timeline and piano roll |
| Waveform/regions | wavesurfer.js | BSD-3-Clause | Use after MVP if audio clips enter UI |
| Multi-track audio reference | waveform-playlist | MIT | Study/selectively reuse later |
| Audio-to-MIDI motif input | Basic Pitch | Apache-2.0 | Phase 2 adapter |
| Symbolic music Python toolkit | MusPy | MIT; dataset licenses remain user responsibility | Research/evaluation reference, not MVP frontend |
| DAW interchange | DAWproject | MIT | Track for post-MVP structured export |
| Text-to-MIDI generation | Text2midi | MIT code; model license/provenance still review | Optional worker after patch loop is proven |
| LLM-to-MIDI generation | MIDI-LLM | Code/model license review required; Llama-family weights are not default commercial-safe | Optional external adapter only |
| Agent-controlled DAW patterns | Producer Pal | GPL-3.0 | Study UX/API; do not copy into core without license review |
| SoundFont render | FluidSynth / FluidLite | LGPL; check WASM/linking | Phase 2 or export worker |
| Full-song local audio | ACE-Step 1.5 | Repo/HF currently presents MIT; still review provenance | Phase 3 optional adapter |
| Source separation | Demucs | MIT; model license still review before bundling | Phase 3 optional |
| Notation preview | OpenSheetMusicDisplay | BSD-3-Clause | Later, not MVP |

Avoid as commercial core unless license is resolved:

- AudioCraft/MusicGen pretrained weights: CC-BY-NC 4.0.
- AudioX models: CC-BY-NC 4.0.
- YourMT3: GPL-3.0.
- WebAudioFont: GPL-3.0.
- openDAW: AGPLv3/commercial dual-license.
- Riffusion: dated, short-loop oriented, additional OpenRAIL/model provenance review needed.

Reference links:

- ACE-Step 1.5: https://github.com/ace-step/ACE-Step-1.5
- ACE-Step UI: https://github.com/fspecii/ace-step-ui
- Majik Studio: https://majiks.studio/
- ACE-Step ComfyUI: https://github.com/ace-step/ACE-Step-ComfyUI
- Basic Pitch: https://github.com/spotify/basic-pitch
- Demucs: https://github.com/facebookresearch/demucs
- Tone.js: https://github.com/Tonejs/Tone.js
- wavesurfer.js: https://github.com/katspaugh/wavesurfer.js
- waveform-playlist: https://github.com/naomiaro/waveform-playlist
- Magenta Studio: https://magenta.withgoogle.com/studio/
- midi-gen: https://github.com/eri24816/midi-gen
- Calliope: https://arxiv.org/abs/2504.14058
- DAWZY: https://arxiv.org/abs/2512.03289
- Producer Pal: https://producer-pal.org/
- DAWproject: https://github.com/bitwig/dawproject
- MusPy: https://github.com/salu133445/muspy
- Text2midi: https://github.com/AMAAI-Lab/Text2midi
- MIDI-LLM: https://github.com/slSeanWU/MIDI-LLM

## 7. Core Product Loop

The MVP loop:

```text
create/open project
  -> create 3-8 note motif
  -> arrange 8/16/32 bars
  -> select bars or section
  -> ask AI for variation
  -> receive structured Music IR patch
  -> preview note/section diff
  -> apply or reject
  -> playback
  -> undo/redo
  -> export MIDI
```

The first public demo should be this exact script:

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

## 8. Music IR

Music IR is the product's differentiator and must be custom.

Minimal shape:

```json
{
  "schemaVersion": 1,
  "projectId": "demo",
  "title": "Untitled",
  "tempo": 120,
  "key": "A minor",
  "timeSignature": "4/4",
  "sections": [
    {
      "id": "sec_a",
      "name": "A",
      "barRange": [1, 8],
      "style": {
        "genre": "minimal piano",
        "energy": 0.35,
        "instruments": ["piano"]
      },
      "motifIds": ["motif_main"],
      "chords": ["Am", "F", "C", "G"],
      "locks": {
        "melody": true,
        "rhythm": false,
        "chords": false,
        "tempo": true,
        "key": true
      }
    }
  ],
  "motifs": [
    {
      "id": "motif_main",
      "notes": [
        { "pitch": "A4", "startBeat": 0, "durationBeats": 0.5, "velocity": 0.8 },
        { "pitch": "C5", "startBeat": 0.5, "durationBeats": 0.5, "velocity": 0.8 }
      ],
      "source": { "type": "manual" },
      "lockStrength": 0.8
    }
  ],
  "tracks": [
    {
      "id": "track_piano",
      "name": "Piano",
      "type": "midi",
      "instrument": "piano",
      "clips": []
    }
  ]
}
```

AI never mutates this directly. It returns an `EditCommand` or `IrPatchProposal`; UI validates, previews, snapshots, then applies.

## 8.1 Local Project Contract

Every MVP project is a folder, not a hidden database blob:

```text
<project>/
  manifest.json
  project.json
  snapshots/
    snap_000001.json
  events.ndjson
  exports/
    demo.mid
```

Required behavior:

- `manifest.json` stores project id, title, schema version, created/updated timestamps, and app version.
- `project.json` stores canonical Music IR.
- `snapshots/*.json` are immutable recovery points, created before AI patches and risky imports.
- `events.ndjson` is append-only and records project created/opened/saved, patch proposed/previewed/applied/rejected, undo/redo, MIDI import/export, capability checks, and adapter failures.
- `exports/` contains generated `.mid` files only in MVP.
- Saves use atomic temp-write plus rename.
- Startup validates manifests and can recover from the latest valid snapshot if `project.json` is corrupt.

Undo/redo, snapshots, and audit events are separate:

- Undo/redo is a short-lived command stack for the active editing session.
- Snapshots are durable recovery points.
- Event log is a factual audit trail, not the undo engine.

## 9. Technical Stack

Frontend:

- React 19 + TypeScript + Vite.
- Tailwind CSS for layout tokens.
- shadcn/ui-style local components built on Radix UI primitives.
- `lucide-react` for icons.
- Zustand for local editor/session state.
- TanStack Query for bridge API state.
- React Hook Form + Zod resolver for forms.
- Konva/react-konva for timeline and piano roll.
- Tone.js and `@tonejs/midi` for playback and MIDI IO.
- Playwright for E2E and visual/canvas checks.

UI/UX rules are specified in `docs/uiux.md`.

Local bridge:

- Node.js 24 Active LTS preferred; Node.js 22 Maintenance LTS supported while dependency compatibility requires it.
- TypeScript.
- Fastify for HTTP API.
- `@fastify/websocket` for job/agent streaming.
- Zod for request/response validation.
- `better-sqlite3` for project index, jobs, snapshots metadata.
- `execa` for subprocess adapters.
- `p-queue` or equivalent for job concurrency and per-project write locks.
- Filesystem project folders for project data and exported assets.
- Subprocess adapters for Codex, Claude, Python workers, and future model tools.

Workers:

- MVP: TypeScript deterministic MIDI generation and transform logic.
- Phase 2: Python workers for Basic Pitch, FluidSynth/ffmpeg render, audio analysis.
- Phase 3: ACE-Step, Demucs, image-to-music-brief, and other optional heavy adapters.

## 10. Agent Integration

Browser does not launch local agents. `src/local-bridge` owns all subprocesses.

### 10.1 Core Architecture

Local CLI capability found on this machine:

- `codex` exists and supports `codex exec` for non-interactive execution.
- `claude` exists and supports `claude --print`, `--output-format stream-json`, and `--json-schema`.

MVP adapter strategy:

```text
UI prompt
  -> local bridge validates project + selection
  -> bridge loads Music IR snapshot as AgentState
  -> adapter runs LangGraph ReAct loop:
       AnalyzeRequest → Plan → ToolCall → Observe → GeneratePatch → SelfValidate → Finalize
       (multi-step, LLM reasons + calls music-domain tools, tools are read-only or
        produce intermediate artifacts, agent CANNOT write to project files)
  -> adapter returns IrPatchProposal
  -> Zod validates
  -> UI shows diff
  -> user applies or rejects
```

### 10.2 LangGraph ReAct Loop

The agent uses **LangGraph** (`@langchain/langgraph`) to orchestrate a stateful ReAct (Reason + Act) loop as an **adapter-internal implementation detail**. The external API contract (AgentRequest → AgentStreamEvents → IrPatchProposal) does not change.

Key design points:

- **ReAct loop runs inside the bridge adapter**, not in the browser
- **10 music-domain tools** available to the LLM: read_ir_section, analyze_motif, analyze_chord_progression, generate_motif_variation, generate_counter_melody, generate_bassline, generate_drum_pattern, validate_patch_schema, check_lock_violations, build_patch_json
- All tools are **read-only or produce intermediate artifacts** — none can write to project files
- **Safety limits**: max 10 iterations, max 5 tool calls per step, 30s timeout
- **Streaming**: each reasoning step and tool call emits an AgentStreamEvent so the user can see the agent's thought process
- **Self-validation**: generated patches are validated against schema and lock constraints before returning to the UI
- **Mock agent** implements the same ReAct graph with deterministic tool outputs for testing

```text
LangGraph State Machine:
  START → ANALYZE → PLAN → TOOL_EXECUTE → OBSERVE
                ↑                              │
                └────── need_more ─────────────┘
                           │ confident
                           ▼
                GENERATE_PATCH → SELF_VALIDATE
                           │            │
                      passes        fails → back to PLAN
                           │
                           ▼
                       FINALIZE → END
```

### 10.3 New Dependencies

```text
@langchain/langgraph     — TypeScript state machine for ReAct loop
@langchain/anthropic     — Claude LLM backend (optional, capability-gated)
@langchain/openai        — Codex LLM backend (optional, capability-gated)
@langchain/core          — Base messages, tools, prompts
```

These are **adapter-level dependencies**. Default tests use the mock agent (no LLM required). Real LLM backends are capability-gated behind `CC_MUSIC_AGENT_ADAPTER=claude` or `=codex`.

Default test mode uses `mock-agent`, not real Claude/Codex.

## 11. Milestones

### M0: Repo + Guardrails

- Initialize git if missing and add root ignore rules.
- pnpm workspace.
- React app.
- Node local bridge.
- Shared packages.
- Vitest + Playwright.
- `CLAUDE.md` and `AGENTS.md`.
- Mock-only default test mode.
- Root `.gitignore`, `.editorconfig`, package manager config, TypeScript config, lint/test config, and CI.
- `docs/ownership.md` task table for subagent allowed files, forbidden files, required tests, and integration order.
- Reference project clones ignored from the root and from `docs/reference-projects/.gitignore`.

Done:

- `pnpm dev` boots app and bridge.
- `pnpm test` runs unit tests.
- Playwright smoke test opens the workbench.
- `pnpm typecheck` exists and passes.
- `git status --ignored` proves reference clones are not staged.

### M1: Music IR + Project Files

- Zod schemas for Music IR, EditCommand, IrPatchProposal.
- Local project create/open/save.
- Strict project folder contract: `manifest.json`, `project.json`, `snapshots/*.json`, `events.ndjson`, `exports/`.
- Snapshot/version model.
- Local audit event schema.
- Crash recovery behavior.
- Capability/tool registry schema.
- Fixture project.

Done:

- Project round trip passes tests.
- Invalid IR is rejected.
- Snapshot created before every applied patch.
- Project can recover from latest valid snapshot when `project.json` is invalid.
- Audit events are appended for project save, patch apply/reject, undo/redo, MIDI import/export, and adapter failure.

### M2: Arrangement Timeline

- Timeline renders sections and bars.
- Select bar range.
- Inspector shows selected bars/section/locks.
- Basic section operations: create, rename, duplicate.

Done:

- Playwright can select bars 9-16.
- Canvas/screenshot tests prove timeline is visible and selection is highlighted.

### M3: Piano Roll + Motifs

- Piano-roll grid.
- Create/edit/delete notes.
- Motif save/reuse.
- Basic transforms: transpose, repeat, inversion, rhythm stretch/compress.
- MIDI import/export through `@tonejs/midi`.

Done:

- User can enter 3-8 notes, save motif, generate/duplicate section material.
- MIDI round-trip preserves notes and tempo.

### M4: Agent Patch Loop (ReAct + LangGraph)

- LangGraph TypeScript state machine: Analyze → Plan → ToolCall → Observe → Generate → Validate → Finalize.
- 10 music-domain tools with function calling: read IR, analyze motif, generate variations, validate patches, render previews.
- Mock agent implements full ReAct graph with deterministic tool outputs for testing.
- Real Codex/Claude adapters behind capability flags, using `@langchain/anthropic` / `@langchain/openai`.
- Streaming thought log: each ReAct step emitted as AgentStreamEvent to UI.
- Self-validation: schema + lock checks before returning proposal to user.
- Diff preview + Apply/Reject with undo/redo.
- Safety: max 10 iterations, max 5 tool calls per step, 30s timeout, no direct file writes.

Done:

- Mock ReAct agent returns valid patch with visible reasoning steps.
- Prompt "make bars 9-16 darker but keep motif" triggers: analyze section → plan edits → generate variation → self-validate → propose patch.
- UI previews note/section changes with thought log visible.
- Apply updates Music IR through mutation pipeline.
- Undo restores prior snapshot.
- All failure modes testable: invalid tool output, schema-invalid patch, timeout, max iterations.

### M5: Export + Demo Hardening

- MIDI export.
- Basic audio preview through Tone.js.
- Demo project seed.
- Full Playwright happy path.

Done:

- End-to-end demo script passes.
- No GPU, ffmpeg, Basic Pitch, ACE-Step, Claude, or Codex is required for default tests.

## 12. Post-MVP Adapters

Only after the MIDI core works:

1. Basic Pitch: audio/humming to motif.
2. FluidSynth/ffmpeg: higher-quality WAV render.
3. OpenCLIP/Qwen-VL: image to music brief.
4. ACE-Step 1.5: optional local audio generation/repaint/export.
5. Demucs: optional stem separation.
6. OpenSheetMusicDisplay: notation preview.
7. Text2midi/MIDI-LLM: optional text-to-MIDI workers.
8. DAWproject: structured export to compatible DAWs.
9. MCP exposure: optional integration layer after internal `IrPatchProposal` is stable.

Post-MVP adapters must implement the same job contract and have mock workers first.

## 13. Business / Open Source Direction

License decision:

- Use `AGPL-3.0-or-later` for the app and local bridge.
- Keep dependencies under their upstream licenses.
- Consider dual licensing only if future commercial embedding becomes important.

Open-source core:

- Editor.
- Music IR.
- Local bridge.
- Mock workers.
- MIDI generation/transforms.
- Project format.

Possible paid/open-core later:

- One-click installers.
- Managed model downloads.
- Cloud GPU rendering.
- Premium SoundFont/sample packs with clean licenses.
- Workflow packs for game BGM/electronic loops/video scoring.
- Team sync/collaboration.

The defensible asset is not a single model wrapper. It is the Music IR, editing workflow, project history, and plugin ecosystem around precise AI-assisted composition.
