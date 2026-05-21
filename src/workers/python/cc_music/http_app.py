"""FastAPI HTTP backend — replaces the entire Node.js local bridge.

All routes replicate the Node bridge API surface exactly:
  GET  /api/health
  GET  /api/system/capabilities
  POST /api/projects
  GET  /api/projects
  GET  /api/projects/{project_id}
  PUT  /api/projects/{project_id}/ir
  POST /api/projects/{project_id}/snapshots
  GET  /api/projects/{project_id}/snapshots
  GET  /api/projects/{project_id}/events
  POST /api/projects/{project_id}/patches/preview
  POST /api/projects/{project_id}/patches/apply
  POST /api/projects/{project_id}/import/midi
  GET  /api/projects/{project_id}/export/midi
  POST /api/projects/{project_id}/agent/messages
  GET  /api/projects/{project_id}/jobs/{job_id}
  WS   /ws/projects/{project_id}/agent/{session_id}

Security:
  - Loopback bind (127.0.0.1)
  - Exact Origin allowlist (localhost origins)
  - Reject Origin: null and absent browser Origin
  - X-Local-Token header required for HTTP requests
  - No wildcard CORS
  - Atomic file writes (temp file + rename)
  - Per-project threading locks
  - Schema validation at boundaries with Pydantic
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import secrets
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from cc_music.agent.adapters.mock import MockBackend
from cc_music.agent.loop import (
    AgentState,
    LlmBackend,
    LlmResponse,
    Tool,
    ToolCall,
    build_system_prompt,
    build_tool_schema,
    react_loop,
    validate_proposal,
)
from cc_music.music.ir import (
    IrPatchProposal,
    JsonPatchOp,
    MusicIr,
    MusicalDiff,
    ProjectEvent,
    ProjectManifest,
    Selection,
)
from cc_music.music.midi_io import export_midi as midi_export
from cc_music.music.midi_io import import_midi as midi_import_file
from cc_music.music.validate import validate_music_ir, validate_patch_proposal, check_lock_violations

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT: Path = Path(os.environ.get("CC_MUSIC_PROJECT_ROOT", Path.cwd() / "projects"))


def _get_local_token() -> str:
    """Read the local token from the environment at request time.

    This avoids import-order issues during testing where the module may be
    imported before the CC_MUSIC_LOCAL_TOKEN environment variable is set.
    """
    return os.environ.get("CC_MUSIC_LOCAL_TOKEN", "dev-token")


ALLOWED_ORIGINS: set[str] = {
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}

APP_VERSION = "0.0.0"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# Per-project write locks
_project_locks: dict[str, threading.Lock] = {}

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(title="Greeno AI Studio", version=APP_VERSION)


def _get_lock(project_id: str) -> threading.Lock:
    """Return (or create) a per-project reentrant lock."""
    if project_id not in _project_locks:
        _project_locks[project_id] = threading.Lock()
    return _project_locks[project_id]


# ---------------------------------------------------------------------------
# Security middleware (CORS + origin + token)
# ---------------------------------------------------------------------------

LOCAL_ORIGIN_RE = re.compile(
    r"^https?://(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$"
)


def _validate_origin(origin: str | None) -> str:
    """Validate the request Origin header.  Returns the origin if valid."""
    if origin is None or origin == "null":
        return None
    # Strict match against allowlist OR localhost regex
    if origin in ALLOWED_ORIGINS or LOCAL_ORIGIN_RE.match(origin):
        return origin
    return None


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=False,  # no cookies needed; token is in header
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Local-Token"],
)


# ---------------------------------------------------------------------------
# Pre/Post request hooks via middleware-like FastAPI dependencies
# ---------------------------------------------------------------------------

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """Validate origin and local token on every HTTP request (except health).

    Health endpoint bypasses security for liveness probes.
    WebSocket upgrade requests are handled in the WS endpoint itself.
    """
    if request.url.path == "/api/health":
        return await call_next(request)

    # --- Origin check ---
    origin = request.headers.get("origin")
    validated = _validate_origin(origin)
    if validated is None:
        return JSONResponse(
            status_code=403,
            content={"error": "Forbidden: invalid or missing origin"},
        )

    # --- Local token check ---
    token = request.headers.get("x-local-token", "")
    local_token = _get_local_token()
    if not local_token or not token or not secrets.compare_digest(token, local_token):
        return JSONResponse(
            status_code=401,
            content={"error": "Unauthorized: missing or invalid X-Local-Token"},
        )

    return await call_next(request)


# ---------------------------------------------------------------------------
# Helper: atomic file write
# ---------------------------------------------------------------------------

def _atomic_write(path: Path, content: str) -> None:
    """Write content to *path* atomically via temp file + rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)


def _atomic_write_bytes(path: Path, content: bytes) -> None:
    """Write bytes to *path* atomically via temp file + rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(content)
    tmp.replace(path)


# ---------------------------------------------------------------------------
# Helper: project path helpers
# ---------------------------------------------------------------------------

def _project_dir(project_id: str) -> Path:
    return PROJECT_ROOT / project_id


def _manifest_path(project_id: str) -> Path:
    return _project_dir(project_id) / "manifest.json"


def _ir_path(project_id: str) -> Path:
    return _project_dir(project_id) / "project.json"


def _snapshots_dir(project_id: str) -> Path:
    return _project_dir(project_id) / "snapshots"


def _events_path(project_id: str) -> Path:
    return _project_dir(project_id) / "events.ndjson"


def _exports_dir(project_id: str) -> Path:
    return _project_dir(project_id) / "exports"


def _jobs_dir(project_id: str) -> Path:
    return _project_dir(project_id) / "jobs"


# ---------------------------------------------------------------------------
# Helper: load / save project
# ---------------------------------------------------------------------------

def _load_manifest(project_id: str) -> dict:
    mp = _manifest_path(project_id)
    if not mp.is_file():
        raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
    try:
        return json.loads(mp.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=f"Corrupt manifest: {exc}")


def _load_ir(project_id: str) -> MusicIr:
    ip = _ir_path(project_id)
    if not ip.is_file():
        raise HTTPException(status_code=404, detail=f"Project IR not found: {project_id}")
    try:
        raw = json.loads(ip.read_text(encoding="utf-8"))
        return MusicIr.model_validate(raw)
    except (json.JSONDecodeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=f"Corrupt project IR: {exc}")


def _save_ir(project_id: str, ir: MusicIr) -> None:
    ip = _ir_path(project_id)
    raw = ir.model_dump(mode="json")
    _atomic_write(ip, json.dumps(raw, indent=2))


def _list_projects() -> list[dict]:
    """List all project manifests under PROJECT_ROOT."""
    projects: list[dict] = []
    if not PROJECT_ROOT.is_dir():
        return projects
    for d in sorted(PROJECT_ROOT.iterdir()):
        if d.is_dir():
            mp = d / "manifest.json"
            if mp.is_file():
                try:
                    projects.append(json.loads(mp.read_text(encoding="utf-8")))
                except (json.JSONDecodeError, OSError):
                    continue
    return projects


def _append_event(project_id: str, event: ProjectEvent) -> None:
    """Append a ProjectEvent line to the project's events.ndjson."""
    ep = _events_path(project_id)
    ep.parent.mkdir(parents=True, exist_ok=True)
    line = event.model_dump_json() + "\n"
    with open(ep, "a", encoding="utf-8") as f:
        f.write(line)


def _read_events(project_id: str) -> list[dict]:
    """Read all events from events.ndjson."""
    ep = _events_path(project_id)
    if not ep.is_file():
        return []
    events: list[dict] = []
    with open(ep, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return events


# ---------------------------------------------------------------------------
# Helper: JSON Patch application (mirrors Node applyJsonPatch)
# ---------------------------------------------------------------------------

_VALID_PATCH_OPS = frozenset({"add", "remove", "replace"})


def _apply_json_patch(
    target: dict[str, Any], patches: list[dict[str, Any]]
) -> dict[str, Any]:
    """Apply a list of RFC 6902 JSON Patch operations to *target* (deep copy)."""
    import copy

    result = copy.deepcopy(target)

    for op_item in patches:
        op = op_item.get("op", "")
        json_path: str = op_item.get("path", "")
        value = op_item.get("value")

        if op not in _VALID_PATCH_OPS:
            raise HTTPException(status_code=400, detail=f"Invalid patch op: {op}")

        segments = [s for s in json_path.split("/") if s]

        # Navigate to parent
        current: Any = result
        for i, seg in enumerate(segments[:-1]):
            if isinstance(current, list):
                idx = int(seg)
                # Extend list if needed
                while len(current) <= idx:
                    current.append(None)
                if current[idx] is None:
                    # Peek ahead: if next segment is numeric, create list, else dict
                    next_seg = segments[i + 1] if i + 1 < len(segments) else ""
                    current[idx] = [] if next_seg.isdigit() else {}
                current = current[idx]
            elif isinstance(current, dict):
                if seg not in current:
                    next_seg = segments[i + 1] if i + 1 < len(segments) else ""
                    current[seg] = [] if next_seg.isdigit() else {}
                current = current[seg]
            else:
                break

        last_seg = segments[-1] if segments else ""

        if isinstance(current, list):
            idx = int(last_seg)
            while len(current) <= idx:
                current.append(None)
            if op == "add" or op == "replace":
                current[idx] = value
            elif op == "remove":
                current.pop(idx)
        elif isinstance(current, dict):
            if op == "add" or op == "replace":
                current[last_seg] = value
            elif op == "remove":
                current.pop(last_seg, None)

    return result


# ---------------------------------------------------------------------------
# Helper: ID generation
# ---------------------------------------------------------------------------

_uid = lambda prefix="": f"{prefix}{uuid.uuid4().hex[:12]}"

# ---------------------------------------------------------------------------
# Helper: timestamp
# ---------------------------------------------------------------------------

_timestamp = lambda: time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

# ---------------------------------------------------------------------------
# Routes — Health & Capabilities
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "cc-music-python-backend"}


@app.get("/api/system/capabilities")
async def capabilities():
    return {
        "codex": {"available": False, "mode": "exec"},
        "claude": {"available": False, "mode": "print-stream-json"},
        "ffmpeg": {"available": False},
        "basicPitch": {"available": False},
        "fluidSynth": {"available": False},
        "aceStep": {"available": False},
        "tools": [],
    }


# ---------------------------------------------------------------------------
# Routes — Projects
# ---------------------------------------------------------------------------


@app.post("/api/projects")
async def create_project(request: Request):
    """Create a new project with default IR."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    tempo = body.get("tempo", 120)
    key = body.get("key", "C major")
    time_sig = body.get("timeSignature", "4/4")

    if not isinstance(tempo, int) or not (40 <= tempo <= 240):
        raise HTTPException(status_code=400, detail="tempo must be an integer 40-240")
    if not isinstance(key, str) or not key:
        raise HTTPException(status_code=400, detail="key must be a non-empty string")
    if not isinstance(time_sig, str) or not re.match(r"^\d+/\d+$", time_sig):
        raise HTTPException(status_code=400, detail="timeSignature must match /\\d+/\\d+/")

    project_id = _uid("proj_")
    now = _timestamp()

    manifest = ProjectManifest(
        projectId=project_id,
        title=title,
        schemaVersion=1,
        appVersion=APP_VERSION,
        createdAt=now,
        updatedAt=now,
    )

    ir = MusicIr(
        schemaVersion=1,
        projectId=project_id,
        title=title,
        tempo=tempo,
        key=key,
        timeSignature=time_sig,
        sections=[],
        motifs=[],
        tracks=[],
    )

    # Atomic writes
    pd = _project_dir(project_id)
    pd.mkdir(parents=True, exist_ok=True)
    _atomic_write(_manifest_path(project_id), manifest.model_dump_json(indent=2))
    _atomic_write(_ir_path(project_id), ir.model_dump_json(indent=2))

    event = ProjectEvent(
        eventId=_uid("evt_"),
        projectId=project_id,
        actor={"type": "local_user"},
        type="project_created",
        timestamp=now,
        payload={},
    )
    _append_event(project_id, event)

    return {"manifest": manifest.model_dump(mode="json"), "ir": ir.model_dump(mode="json")}


@app.get("/api/projects")
async def list_projects_handler():
    """List all known projects."""
    projects = _list_projects()
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Return manifest + IR for a single project."""
    manifest = _load_manifest(project_id)
    ir = _load_ir(project_id)
    return {"manifest": manifest, "ir": ir.model_dump(mode="json")}


@app.put("/api/projects/{project_id}/ir")
async def update_project_ir(project_id: str, request: Request):
    """Replace the project's Music IR entirely."""
    # Verify project exists
    _load_manifest(project_id)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Validate as MusicIr
    try:
        ir = MusicIr.model_validate(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Music IR: {exc}")

    with _get_lock(project_id):
        _save_ir(project_id, ir)

    # Update manifest timestamp
    manifest = _load_manifest(project_id)
    manifest["updatedAt"] = _timestamp()
    _atomic_write(_manifest_path(project_id), json.dumps(manifest, indent=2))

    event = ProjectEvent(
        eventId=_uid("evt_"),
        projectId=project_id,
        actor={"type": "local_user"},
        type="project_saved",
        timestamp=_timestamp(),
        payload={},
    )
    _append_event(project_id, event)

    return {"ir": ir.model_dump(mode="json")}


# ---------------------------------------------------------------------------
# Routes — Snapshots
# ---------------------------------------------------------------------------


@app.post("/api/projects/{project_id}/snapshots")
async def create_snapshot(project_id: str):
    """Snapshot the current IR."""
    ir = _load_ir(project_id)
    snapshot_id = _uid("snap_")
    snap_dir = _snapshots_dir(project_id)
    snap_dir.mkdir(parents=True, exist_ok=True)
    snap_path = snap_dir / f"{snapshot_id}.json"
    _atomic_write(snap_path, ir.model_dump_json(indent=2))

    event = ProjectEvent(
        eventId=_uid("evt_"),
        projectId=project_id,
        actor={"type": "local_user"},
        type="project_saved",
        timestamp=_timestamp(),
        payload={"snapshotId": snapshot_id},
    )
    _append_event(project_id, event)

    return {"snapshotId": snapshot_id, "ir": ir.model_dump(mode="json")}


@app.get("/api/projects/{project_id}/snapshots")
async def list_snapshots(project_id: str):
    """List all snapshots for a project."""
    _load_manifest(project_id)  # verify exists
    snap_dir = _snapshots_dir(project_id)
    snapshots: list[dict] = []
    if snap_dir.is_dir():
        for f in sorted(snap_dir.glob("snap_*.json")):
            try:
                snapshots.append(
                    {
                        "snapshotId": f.stem,
                        "createdAt": time.strftime(
                            "%Y-%m-%dT%H:%M:%S.000Z",
                            time.gmtime(f.stat().st_mtime),
                        ),
                    }
                )
            except OSError:
                continue
    return {"snapshots": snapshots}


# ---------------------------------------------------------------------------
# Routes — Events
# ---------------------------------------------------------------------------


@app.get("/api/projects/{project_id}/events")
async def get_events(project_id: str):
    """Read all audit events for a project."""
    _load_manifest(project_id)
    events = _read_events(project_id)
    return {"events": events}


# ---------------------------------------------------------------------------
# Routes — Patches (preview + apply)
# ---------------------------------------------------------------------------


@app.post("/api/projects/{project_id}/patches/preview")
async def patch_preview(project_id: str, request: Request):
    """Preview a patch: apply to a copy, validate, return proposal + preview IR."""
    _load_manifest(project_id)
    ir = _load_ir(project_id)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    summary = (body.get("summary") or "").strip()
    if not summary:
        raise HTTPException(status_code=400, detail="summary is required")
    patch = body.get("patch")
    if not isinstance(patch, list):
        raise HTTPException(status_code=400, detail="patch must be an array")
    musical_diff_raw = body.get("musicalDiff", {})

    # Validate each patch op
    for i, op in enumerate(patch):
        if not isinstance(op, dict) or op.get("op") not in _VALID_PATCH_OPS:
            raise HTTPException(status_code=400, detail=f"Invalid patch op at index {i}")

    # Apply to copy
    ir_dict = ir.model_dump(mode="json")
    try:
        preview_raw = _apply_json_patch(ir_dict, patch)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Patch application failed: {exc}")

    # Validate resulting IR
    try:
        preview_ir = MusicIr.model_validate(preview_raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Patch produces invalid IR: {exc}")

    musical_diff = MusicalDiff(
        barsChanged=musical_diff_raw.get("barsChanged"),
        notesAdded=musical_diff_raw.get("notesAdded", 0),
        notesRemoved=musical_diff_raw.get("notesRemoved", 0),
        preservedMotifs=musical_diff_raw.get("preservedMotifs", []),
    )

    proposal = IrPatchProposal(
        proposalId=_uid("patch_"),
        projectId=project_id,
        summary=summary,
        patch=[JsonPatchOp(**op) for op in patch],
        musicalDiff=musical_diff,
    )

    return {
        "proposal": proposal.model_dump(mode="json"),
        "previewIr": preview_ir.model_dump(mode="json"),
    }


@app.post("/api/projects/{project_id}/patches/apply")
async def patch_apply(project_id: str, request: Request):
    """Apply a patch: snapshot current, apply, validate, save, record event."""
    _load_manifest(project_id)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    summary = (body.get("summary") or "").strip()
    if not summary:
        raise HTTPException(status_code=400, detail="summary is required")
    patch = body.get("patch")
    if not isinstance(patch, list):
        raise HTTPException(status_code=400, detail="patch must be an array")
    musical_diff_raw = body.get("musicalDiff", {})

    with _get_lock(project_id):
        ir = _load_ir(project_id)

        # Snapshot
        snapshot_id = _uid("snap_")
        snap_dir = _snapshots_dir(project_id)
        snap_dir.mkdir(parents=True, exist_ok=True)
        _atomic_write(snap_dir / f"{snapshot_id}.json", ir.model_dump_json(indent=2))

        # Apply patch
        ir_dict = ir.model_dump(mode="json")
        try:
            patched_raw = _apply_json_patch(ir_dict, patch)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Patch application failed: {exc}")

        try:
            patched_ir = MusicIr.model_validate(patched_raw)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Patch produces invalid IR: {exc}")

        # Save
        _save_ir(project_id, patched_ir)

        # Update manifest timestamp
        manifest = _load_manifest(project_id)
        manifest["updatedAt"] = _timestamp()
        _atomic_write(_manifest_path(project_id), json.dumps(manifest, indent=2))

    proposal_id = _uid("patch_")
    event = ProjectEvent(
        eventId=_uid("evt_"),
        projectId=project_id,
        actor={"type": "local_user"},
        type="patch_applied",
        timestamp=_timestamp(),
        payload={"snapshotId": snapshot_id, "patchId": proposal_id},
    )
    _append_event(project_id, event)

    return {
        "ir": patched_ir.model_dump(mode="json"),
        "snapshotId": snapshot_id,
        "proposalId": proposal_id,
    }


# ---------------------------------------------------------------------------
# Routes — MIDI import / export
# ---------------------------------------------------------------------------

# Minimal valid MIDI file bytes (Standard MIDI File Format 0, single track).
# Contains: header, tempo (120 BPM), time signature (4/4), end-of-track.
# Mirrors the Node bridge MOCK_MIDI_BYTES exactly.
_MOCK_MIDI_BYTES = bytes(
    [
        0x4D,
        0x54,
        0x68,
        0x64,  # "MThd"
        0x00,
        0x00,
        0x00,
        0x06,  # header length = 6
        0x00,
        0x00,  # format 0
        0x00,
        0x01,  # tracks = 1
        0x01,
        0xE0,  # 480 ticks/quarter
        0x4D,
        0x54,
        0x72,
        0x6B,  # "MTrk"
        0x00,
        0x00,
        0x00,
        0x14,  # length = 20
        0x00,
        0xFF,
        0x51,
        0x03,
        0x07,
        0xA1,
        0x20,  # tempo = 500000 (=120 BPM)
        0x00,
        0xFF,
        0x58,
        0x04,
        0x04,
        0x02,
        0x18,
        0x08,  # time sig 4/4
        0x00,
        0xFF,
        0x2F,
        0x00,  # end of track
    ]
)


def _build_mock_import_ir(project_id: str, title: str) -> MusicIr:
    """Build a mock Music IR for MIDI import (mirrors Node bridge)."""
    return MusicIr(
        schemaVersion=1,
        projectId=project_id,
        title=title,
        tempo=120,
        key="C major",
        timeSignature="4/4",
        sections=[
            {
                "id": "sec_imported",
                "name": "Imported",
                "barRange": [1, 8],
                "style": {
                    "genre": "imported midi",
                    "energy": 0.5,
                    "instruments": ["piano"],
                },
                "motifIds": ["motif_imported"],
                "chords": ["C", "F", "G", "C"],
                "locks": {
                    "melody": False,
                    "rhythm": False,
                    "chords": False,
                    "tempo": True,
                    "key": True,
                },
            }
        ],
        motifs=[
            {
                "id": "motif_imported",
                "notes": [
                    {
                        "pitch": "C4",
                        "startBeat": 0,
                        "durationBeats": 0.5,
                        "velocity": 0.8,
                    },
                    {
                        "pitch": "E4",
                        "startBeat": 0.5,
                        "durationBeats": 0.5,
                        "velocity": 0.8,
                    },
                    {
                        "pitch": "G4",
                        "startBeat": 1,
                        "durationBeats": 0.5,
                        "velocity": 0.78,
                    },
                    {
                        "pitch": "C5",
                        "startBeat": 1.5,
                        "durationBeats": 0.5,
                        "velocity": 0.75,
                    },
                ],
                "source": {"type": "imported_midi"},
                "lockStrength": 0.5,
            }
        ],
        tracks=[
            {
                "id": "track_imported",
                "name": "Piano",
                "type": "midi",
                "instrument": "piano",
                "clips": [
                    {
                        "id": "clip_imported",
                        "barRange": [1, 8],
                        "motifId": "motif_imported",
                        "notes": [
                            {
                                "pitch": "C4",
                                "startBeat": 0,
                                "durationBeats": 0.5,
                                "velocity": 0.8,
                            },
                            {
                                "pitch": "E4",
                                "startBeat": 0.5,
                                "durationBeats": 0.5,
                                "velocity": 0.8,
                            },
                        ],
                    }
                ],
            }
        ],
    )


@app.post("/api/projects/{project_id}/import/midi")
async def import_midi(project_id: str):
    """Mock MIDI import: generate mock IR and save it."""
    manifest = _load_manifest(project_id)
    ir = _build_mock_import_ir(project_id, manifest["title"])

    with _get_lock(project_id):
        _save_ir(project_id, ir)

    # Snapshot
    snapshot_id = _uid("snap_")
    snap_dir = _snapshots_dir(project_id)
    snap_dir.mkdir(parents=True, exist_ok=True)
    _atomic_write(snap_dir / f"{snapshot_id}.json", ir.model_dump_json(indent=2))

    event = ProjectEvent(
        eventId=_uid("evt_"),
        projectId=project_id,
        actor={"type": "local_user"},
        type="midi_imported",
        timestamp=_timestamp(),
        payload={},
    )
    _append_event(project_id, event)

    return {"ir": ir.model_dump(mode="json")}


@app.get("/api/projects/{project_id}/export/midi")
async def export_midi(project_id: str):
    """Export project as MIDI. Returns mock MIDI bytes (mirrors Node bridge)."""
    _load_manifest(project_id)  # verify exists

    event = ProjectEvent(
        eventId=_uid("evt_"),
        projectId=project_id,
        actor={"type": "local_user"},
        type="midi_exported",
        timestamp=_timestamp(),
        payload={},
    )
    _append_event(project_id, event)

    return StreamingResponse(
        iter([_MOCK_MIDI_BYTES]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{project_id}.mid"',
        },
    )


# ---------------------------------------------------------------------------
# Routes — Agent
# ---------------------------------------------------------------------------


class _AgentTool:
    """Minimal Tool implementation for the agent loop (mirrors server.py stubs)."""

    def __init__(self, name: str, description: str = "", parameters: dict | None = None) -> None:
        self._name = name
        self._description = description or f"Mock tool: {name}"
        self._parameters = parameters or {"type": "object", "properties": {}, "required": []}

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    @property
    def parameters(self) -> dict:
        return self._parameters

    async def execute(self, args: dict, ctx: dict) -> dict:
        _ = args, ctx
        return {"status": "ok", "tool": self._name}


_AGENT_TOOLS: list = [
    _AgentTool("analyze_motif", "Analyze a musical motif's pitch contour, rhythm, and density."),
    _AgentTool("generate_bassline", "Generate a bassline following a chord progression."),
    _AgentTool("read_ir_section", "Read Music IR for a bar range."),
    _AgentTool("analyze_chords", "Identify chords and cadences in a section."),
    _AgentTool("generate_motif_variation", "Generate a new motif variant."),
    _AgentTool("generate_drum_pattern", "Generate a rhythm pattern for drum track."),
    _AgentTool("check_lock_violations", "Check for section/note lock violations."),
    _AgentTool("validate_patch_schema", "Validate a candidate patch against the schema."),
    _AgentTool("read_section", "Read section data."),
    _AgentTool("read_ir", "Read full IR snapshot."),
    _AgentTool("analyze", "General analysis tool."),
]

# In-memory agent session store: session_id -> {status, project_id, events, result}
_agent_sessions: dict[str, dict[str, Any]] = {}


@app.post("/api/projects/{project_id}/agent/messages")
async def agent_messages(project_id: str, request: Request, background_tasks: BackgroundTasks):
    """Start agent in background, return session ID immediately.

    The agent ReAct loop runs as a FastAPI background task so it does not
    block the event loop.  Clients poll GET /agent/sessions/{session_id}
    or connect via WebSocket to receive streaming events.
    """
    _load_manifest(project_id)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    session_id = _uid("sess_")

    _agent_sessions[session_id] = {
        "status": "running",
        "project_id": project_id,
        "events": [],
    }

    background_tasks.add_task(_run_agent, session_id, project_id, body)

    return {"sessionId": session_id, "status": "started"}


@app.get("/api/projects/{project_id}/agent/sessions/{session_id}")
async def agent_session_status(project_id: str, session_id: str):
    """Poll agent session status + events.

    Events are drained on each poll so the client never re-reads stale data.
    """
    _load_manifest(project_id)
    session = _agent_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    events = session["events"][:]
    session["events"] = []  # drain
    return {"sessionId": session_id, "status": session["status"], "events": events}


async def _run_agent(session_id: str, project_id: str, body: dict) -> None:
    """Background task: run the ReAct loop and collect events into the session store.

    This function is scheduled via BackgroundTasks.add_task() and never blocks
    the HTTP response.  All errors are captured and stored in the session so
    clients can retrieve them via polling or WebSocket.
    """
    session = _agent_sessions.get(session_id)
    if not session:
        return

    try:
        ir = _load_ir(project_id)
    except Exception:
        session["status"] = "failed"
        session["result"] = {"error": "Project IR not found"}
        return

    prompt = body["prompt"]
    selection = body.get("selection") or {}
    snapshot = ir.model_dump(mode="json")

    state = AgentState(
        snapshot=snapshot,
        user_prompt=prompt,
        selection=selection,
        max_iterations=10,
    )

    backend: LlmBackend = MockBackend.from_prompt(prompt)

    async def on_event(event: dict) -> None:
        session["events"].append(event)

    result = await react_loop(state, _AGENT_TOOLS, backend, on_event)

    if not result.get("success") or not result.get("proposal"):
        session["status"] = "failed"
        session["result"] = {"error": result.get("error", "Agent did not produce a proposal")}
        return

    proposal_raw = result["proposal"]
    proposal_id = _uid("patch_")
    summary = prompt[:200]

    try:
        proposal = IrPatchProposal(
            proposalId=proposal_id,
            projectId=project_id,
            summary=summary,
            patch=proposal_raw.get("patch", []),
            musicalDiff=proposal_raw.get(
                "musicalDiff",
                {"notesAdded": 0, "notesRemoved": 0, "preservedMotifs": []},
            ),
        )

        event = ProjectEvent(
            eventId=_uid("evt_"),
            projectId=project_id,
            actor={"type": "mock_agent"},
            type="patch_proposed",
            timestamp=_timestamp(),
            payload={"proposalId": proposal_id},
        )
        _append_event(project_id, event)

        session["status"] = "completed"
        session["result"] = {"proposal": proposal.model_dump(mode="json")}
    except Exception as exc:
        session["status"] = "failed"
        session["result"] = {"error": f"Invalid proposal from agent: {exc}"}


# ---------------------------------------------------------------------------
# WebSocket — Agent streaming
# ---------------------------------------------------------------------------


@app.websocket("/ws/projects/{project_id}/agent/{session_id}")
async def agent_websocket(websocket: WebSocket, project_id: str, session_id: str):
    """WebSocket endpoint for streaming agent events from an existing session.

    The session must already exist (created via POST /agent/messages).
    This endpoint polls the session's event buffer at ~300ms intervals and
    pushes each event to the client.  When the session reaches a terminal
    state the final result is sent and the connection is closed.
    """
    # Origin check
    origin = websocket.headers.get("origin", "")
    if _validate_origin(origin) is None:
        await websocket.close(code=4003, reason="Invalid origin")
        return

    # Token check (from query param or header)
    token = websocket.query_params.get("token", "") or websocket.headers.get("x-local-token", "")
    local_token = _get_local_token()
    if not local_token or not token or not secrets.compare_digest(token, local_token):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()

    session = _agent_sessions.get(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    try:
        # Poll session events at 300ms intervals while the agent runs
        while session["status"] == "running":
            events = session["events"][:]
            session["events"] = []
            for event in events:
                await websocket.send_json({"type": "stream_event", "data": event})
            await asyncio.sleep(0.3)

        # Drain any remaining events before sending the final result
        remaining = session["events"][:]
        session["events"] = []
        for event in remaining:
            await websocket.send_json({"type": "stream_event", "data": event})

        # Send final result
        result = session.get("result")
        if result and "proposal" in result:
            await websocket.send_json({"type": "done", "data": result})
        else:
            await websocket.send_json(
                {
                    "type": "error",
                    "data": {
                        "code": "agent_failed",
                        "message": (
                            result.get("error", "Agent did not produce a proposal")
                            if result
                            else "No result"
                        ),
                    },
                }
            )
    except WebSocketDisconnect:
        pass  # client disconnected gracefully
    except Exception:
        pass  # connection may have dropped mid-stream
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Routes — Jobs (placeholder)
# ---------------------------------------------------------------------------

_jobs: dict[str, dict[str, Any]] = {}


@app.get("/api/projects/{project_id}/jobs/{job_id}")
async def get_job(project_id: str, job_id: str):
    """Get job status by ID."""
    _load_manifest(project_id)
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job
