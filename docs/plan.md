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

- MVP: Python engine for all compute (agent, transforms, MIDI IO). TypeScript timeline-engine for bar/beat math and selection only.
- Phase 2: Python workers for Basic Pitch, FluidSynth/ffmpeg render, audio analysis.
- Phase 3: ACE-Step, Demucs, image-to-music-brief, and other optional heavy adapters.

## 10. Agent Integration (Python Engine)

Browser never launches agents. Bridge never runs AI. **All agent intelligence lives in Python.**

### 10.1 Architecture

```text
Browser (React)
  │  POST /api/projects/:id/agent/messages
  ▼
Bridge (Node/Fastify)
  │  JSON-RPC over stdin/stdout to Python subprocess
  ▼
Python Engine (cc_music/agent/)
  │  Hand-written ReAct loop (~200 lines)
  │  LLM calls via httpx to any OpenAI-compatible endpoint
  │  10 music-domain tools as Python functions
  │  Pydantic schemas mirror TypeScript Music IR
  │  Streams events back over stdout
  ▼
Bridge validates + returns IrPatchProposal to browser
  ▼
UI shows diff → user applies/rejects
```

### 10.2 ReAct Loop (Pure Python)

No frameworks. ~200 lines:

```python
while iteration < max_iterations:
    response = await llm.chat(messages=history, tools=tool_schemas)
    if response.tool_calls:
        results = await execute_tools(response.tool_calls)
        history.append(tool_results)
    elif response.proposal:
        if validate(response.proposal):
            return response.proposal  # success
        else:
            history.append(validation_errors)  # retry
    else:
        history.append(response.text)  # continue thinking
```

### 10.3 LLM Backends (Swappable)

| Backend | When Used | Transport |
|---|---|---|
| `MockBackend` | Default tests, CI | Returns deterministic responses |
| `OpenAiCompatBackend` | Ollama, vLLM, any local model | `httpx` → `/v1/chat/completions` |
| `ClaudeCliBackend` | Claude CLI available | Subprocess: `claude --print --output-format stream-json` |
| `CodexCliBackend` | Codex CLI available | Subprocess: `codex exec` |

### 10.4 Music Tools

10 Python tools callable by the LLM during ReAct loop. All read-only or produce temp artifacts. None write to project files.

| Category | Tools |
|---|---|
| Read | `read_ir_section`, `analyze_motif`, `analyze_chord_progression` |
| Generate | `generate_motif_variation`, `generate_counter_melody`, `generate_bassline`, `generate_drum_pattern` |
| Validate | `validate_patch_schema`, `check_lock_violations`, `build_patch_json` |

### 10.5 Safety

- Max 10 ReAct iterations
- Max 5 tool calls per step
- 30s timeout (120s for complex)
- Python subprocess killed on timeout/cancel
- No filesystem write access outside temp dir
- All patches Pydantic-validated before returning

Default test mode uses `mock-agent` with deterministic tool outputs.

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

### M4: Agent Patch Loop (Python ReAct + Hand-Written Loop)

- Hand-written ReAct loop in Python (~200 lines). No LangGraph, no LangChain.
- 10 music-domain tools as Python functions. Native OpenAI-compatible function calling via httpx.
- LLM backends: Mock (deterministic), Claude CLI, Codex CLI, any OpenAI-compatible endpoint (Ollama/vLLM).
- Bridge ↔ Python JSON-RPC over stdin/stdout. Bridge only routes messages.
- Streaming thought log: each ReAct step emitted as JSON event to stdout, forwarded to browser.
- Self-validation: Pydantic schema + lock checks before returning proposal.
- Mock agent implements full ReAct loop with deterministic tool outputs for tests.
- Diff preview + Apply/Reject with undo/redo.
- Safety: max 10 iterations, max 5 tool calls per step, 30s timeout, no filesystem writes.

Done:
- Mock ReAct agent returns valid patch with visible reasoning steps.
- Prompt "make bars 9-16 darker" triggers: analyze → plan → generate → validate → propose.
- UI shows thought log + diff preview.
- All failure modes testable via mock agent.
- Python tests run via `uv run pytest`.

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
