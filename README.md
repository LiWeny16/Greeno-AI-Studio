# Greeno AI Studio

Local-first, open-source AI MIDI editor for structured composition.

**AI that edits the song structure you can see and control: bars, sections, motifs, chords, and tracks.**

## Architecture

```
Browser (React/TS)  →  Bridge (Node/Fastify)  →  Python Engine
  Pure UI only          Message router            All compute
  • Timeline            • Project file IO         • ReAct agent loop
  • Piano roll          • Subprocess manager      • LLM tool calling
  • Inspector           • Security / auth         • Music transforms
  • Agent panel         • WebSocket streams       • MIDI import/export
  • Playback (Tone.js)                            • Schema validation
```

## MVP Core Loop

```
Create project → Arrange sections → Enter motif → Ask AI for variation
→ Preview diff → Apply or reject → Undo/redo → Export MIDI
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind, Konva, Tone.js, Zustand |
| Bridge | Node.js 24, Fastify, Zod, SQLite, WebSocket |
| Python Engine | Python 3.12+, Pydantic, httpx, miditoolkit, numpy |
| AI Agent | Hand-written ReAct loop (~200 lines), no frameworks |
| Tests | Vitest, Playwright, pytest |

## Getting Started

```bash
# Frontend + Bridge
pnpm install
pnpm dev          # starts Vite + Fastify bridge

# Python Engine
cd src/workers/python
uv sync
uv run python -m cc_music.server
```

## Project Structure

```
src/
  studio-web/        # Frontend: pure UI
  local-bridge/      # Bridge: message router + file IO
  workers/python/    # Python Engine: ALL compute
    cc_music/
      agent/         # ReAct loop, tools, LLM adapters
      music/         # Music IR models, transforms, MIDI IO
  packages/          # Shared TS schemas + fixtures
```

## License

AGPL-3.0-or-later
