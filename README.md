# Greeno AI Studio

Local-first, open-source AI MIDI editor for structured composition.

**AI that edits the song structure you can see and control: bars, sections, motifs, chords, and tracks.**

## Architecture

```
Browser (React/TS)  ── HTTP + WebSocket ──→  Python Backend (FastAPI)
  Pure UI only                                All compute in one process
  • Timeline                                  • HTTP REST + WebSocket server
  • Piano roll                                • ReAct agent loop
  • Inspector                                 • LLM tool calling
  • Agent panel                               • Music transforms
  • Playback (Tone.js)                        • MIDI import/export
                                              • Project file IO
                                              • Schema validation (Pydantic)
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
| Backend | Python 3.12+, FastAPI, uvicorn, Pydantic, SQLite, WebSocket |
| AI Agent | Hand-written ReAct loop (~200 lines), no frameworks |
| Tests | Vitest, Playwright, pytest |

## Getting Started

```bash
# Frontend
pnpm install
pnpm dev          # starts Vite dev server

# Python Backend
cd src/workers/python
uv sync
uv run python -m cc_music.server    # starts FastAPI on port 8787
```

## Project Structure

```
src/
  studio-web/        # Frontend: pure UI
  workers/python/    # Python Backend: FastAPI + ALL compute
    cc_music/
      api/           # HTTP + WebSocket routes
      agent/         # ReAct loop, tools, LLM adapters
      music/         # Music IR models, transforms, MIDI IO
      schema/        # Pydantic schemas
  packages/          # Shared TS schemas + fixtures
```

## License

AGPL-3.0-or-later
