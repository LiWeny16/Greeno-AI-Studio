"""Pydantic v2 models mirroring the TypeScript Music IR (Zod schemas).

These schemas are the Python-side contract for all music data crossing
the bridge boundary. Parity with TS is enforced by shared JSON fixtures.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Optional

from pydantic import AfterValidator, BaseModel, Field


# ---------------------------------------------------------------------------
# Reusable validators
# ---------------------------------------------------------------------------


def _validate_bar_range(v: tuple[int, int]) -> tuple[int, int]:
    start, end = v
    if start <= 0 or end <= 0:
        raise ValueError("bar range values must be positive integers")
    if start > end:
        raise ValueError("bar range start must be <= end")
    return v


def _validate_non_empty_strings(v: list[str]) -> list[str]:
    for i, s in enumerate(v):
        if not isinstance(s, str) or not s:
            raise ValueError(f"Element at index {i} must be a non-empty string")
    return v


# ---------------------------------------------------------------------------
# Core type aliases
# ---------------------------------------------------------------------------

BarRange = Annotated[tuple[int, int], AfterValidator(_validate_bar_range)]

NonEmptyStrList = Annotated[list[str], AfterValidator(_validate_non_empty_strings)]


# ---------------------------------------------------------------------------
# Leaf models
# ---------------------------------------------------------------------------


class Note(BaseModel):
    """A single MIDI note within a motif or clip."""

    pitch: str = Field(min_length=1)
    startBeat: float = Field(ge=0)
    durationBeats: float = Field(gt=0)
    velocity: float = Field(ge=0, le=1)


class MotifSource(BaseModel):
    """Origin of a motif."""

    type: Literal[
        "manual",
        "imported_midi",
        "agent",
        "transform",
        "audio_to_midi",
        "image_brief",
    ]


class Motif(BaseModel):
    """A reusable musical phrase."""

    id: str = Field(min_length=1)
    notes: list[Note]
    source: MotifSource
    lockStrength: float = Field(default=0.5, ge=0, le=1)


class Style(BaseModel):
    """Stylistic constraints for a section."""

    genre: str = Field(min_length=1)
    energy: float = Field(ge=0, le=1)
    instruments: NonEmptyStrList


class LockState(BaseModel):
    """Per-property locks that prevent mutation of specific aspects."""

    melody: bool
    rhythm: bool
    chords: bool
    tempo: bool
    key: bool


class Section(BaseModel):
    """A contiguous range of bars with style, chords, and motif bindings."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    barRange: BarRange
    style: Style
    motifIds: NonEmptyStrList
    chords: NonEmptyStrList
    locks: LockState


class MidiClip(BaseModel):
    """A contiguous MIDI region on a track."""

    id: str = Field(min_length=1)
    barRange: BarRange
    motifId: Optional[str] = Field(default=None, min_length=1)
    notes: list[Note]


class Track(BaseModel):
    """A single instrument track containing MIDI clips."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    type: Literal["midi"]
    instrument: str = Field(min_length=1)
    clips: list[MidiClip]


# ---------------------------------------------------------------------------
# Top-level models
# ---------------------------------------------------------------------------


class MusicIr(BaseModel):
    """Canonical Music IR — the source of truth for a project."""

    schemaVersion: Literal[1]
    projectId: str = Field(min_length=1)
    title: str = Field(min_length=1)
    tempo: int = Field(ge=40, le=240)
    key: str = Field(min_length=1)
    timeSignature: str = Field(pattern=r"^\d+/\d+$")
    sections: list[Section]
    motifs: list[Motif]
    tracks: list[Track]


class ProjectManifest(BaseModel):
    """Project-level metadata."""

    projectId: str = Field(min_length=1)
    title: str = Field(min_length=1)
    schemaVersion: Literal[1]
    appVersion: str = Field(min_length=1)
    createdAt: str
    updatedAt: str
    owner: Optional[str] = None
    team: Optional[str] = None


# ---------------------------------------------------------------------------
# Actor / Event
# ---------------------------------------------------------------------------


class Actor(BaseModel):
    """The entity that performed an action."""

    type: Literal["local_user", "mock_agent", "codex", "claude", "worker"]


ProjectEventType = Literal[
    "project_created",
    "project_opened",
    "project_saved",
    "patch_proposed",
    "patch_previewed",
    "patch_applied",
    "patch_rejected",
    "undo",
    "redo",
    "midi_imported",
    "midi_exported",
    "capability_checked",
    "adapter_failed",
    "project_recovered",
]


class ProjectEvent(BaseModel):
    """Immutable audit event appended to a project's event log."""

    eventId: str = Field(min_length=1)
    projectId: str = Field(min_length=1)
    actor: Actor
    type: ProjectEventType
    timestamp: str
    payload: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Edit command
# ---------------------------------------------------------------------------


class Selection(BaseModel):
    """Target spec for an edit command."""

    barRange: Optional[BarRange] = None
    sectionIds: Optional[NonEmptyStrList] = None
    trackIds: Optional[NonEmptyStrList] = None
    noteIds: Optional[NonEmptyStrList] = None


EditCommandType = Literal[
    "create_section",
    "rename_section",
    "move_section",
    "edit_notes",
    "transpose",
    "quantize",
    "apply_ir_patch",
    "undo",
    "redo",
    "import_midi",
]


class EditCommand(BaseModel):
    """A user-issued command that mutates project state."""

    commandId: str = Field(min_length=1)
    projectId: str = Field(min_length=1)
    type: EditCommandType
    selection: Selection = Field(default_factory=Selection)
    payload: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Patch / IR patch proposal
# ---------------------------------------------------------------------------


class JsonPatchOp(BaseModel):
    """A single RFC 6902 JSON Patch operation."""

    op: Literal["add", "remove", "replace"]
    path: str = Field(pattern=r"^/")
    value: Any = None


class MusicalDiff(BaseModel):
    """Human-readable summary of what a patch changes musically."""

    barsChanged: Optional[BarRange] = None
    notesAdded: int = Field(default=0, ge=0)
    notesRemoved: int = Field(default=0, ge=0)
    preservedMotifs: NonEmptyStrList = Field(default_factory=list)


class IrPatchProposal(BaseModel):
    """A structured patch proposal generated by an agent."""

    proposalId: str = Field(min_length=1)
    projectId: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    patch: list[JsonPatchOp]
    musicalDiff: MusicalDiff


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def validate_music_ir(data: dict) -> MusicIr:
    """Parse and validate a dict into a MusicIr model."""
    return MusicIr.model_validate(data)


def validate_patch_proposal(data: dict) -> IrPatchProposal:
    """Parse and validate a dict into an IrPatchProposal model."""
    return IrPatchProposal.model_validate(data)


def ir_to_json(ir: MusicIr) -> str:
    """Serialize a MusicIr model to a JSON string."""
    return ir.model_dump_json(indent=2)


def ir_from_json(json_str: str) -> MusicIr:
    """Deserialize a JSON string into a MusicIr model with validation."""
    return MusicIr.model_validate_json(json_str)
