"""Schema + lock validation for Music IR data.

Validates incoming data against expected Music IR shapes before any mutation.
Includes project-lock and selection-range checks.
"""

from __future__ import annotations

import re
from typing import Any

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TIME_SIG_RE = re.compile(r"^\d+/\d+$")
_VALID_SOURCE_TYPES = frozenset({
    "manual", "imported_midi", "agent", "transform", "audio_to_midi", "image_brief",
})
_VALID_PATCH_OPS = frozenset({"add", "remove", "replace"})


def _non_empty_str(value: object) -> bool:
    return isinstance(value, str) and len(value) > 0


# ---------------------------------------------------------------------------
# Note / Clip  helpers
# ---------------------------------------------------------------------------

def _validate_note(note: object, prefix: str, errors: list[str]) -> None:
    if not isinstance(note, dict):
        errors.append(f"{prefix}: note must be an object")
        return
    if not _non_empty_str(note.get("pitch")):
        errors.append(f"{prefix}.pitch: must be a non-empty string")
    if not isinstance(note.get("startBeat"), (int, float)) or note["startBeat"] < 0:
        errors.append(f"{prefix}.startBeat: must be a non-negative number")
    if not isinstance(note.get("durationBeats"), (int, float)) or note["durationBeats"] <= 0:
        errors.append(f"{prefix}.durationBeats: must be a positive number")
    if not isinstance(note.get("velocity"), (int, float)) or not (0 <= note["velocity"] <= 1):
        errors.append(f"{prefix}.velocity: must be a number between 0 and 1")


def _validate_bar_range(br: object, prefix: str, errors: list[str]) -> None:
    if not isinstance(br, (list, tuple)) or len(br) != 2:
        errors.append(f"{prefix}: barRange must be a 2-element array")
        return
    a, b = br[0], br[1]
    if not (isinstance(a, int) and isinstance(b, int) and a > 0 and b > 0):
        errors.append(f"{prefix}: barRange elements must be positive integers")
    if a > b:
        errors.append(f"{prefix}: barRange start must be <= end")


def _validate_clip(clip: object, prefix: str, errors: list[str]) -> None:
    if not isinstance(clip, dict):
        errors.append(f"{prefix}: clip must be an object")
        return
    if not _non_empty_str(clip.get("id")):
        errors.append(f"{prefix}.id: must be a non-empty string")
    _validate_bar_range(clip.get("barRange"), f"{prefix}.barRange", errors)
    if "motifId" in clip and not _non_empty_str(clip.get("motifId")):
        errors.append(f"{prefix}.motifId: must be a non-empty string when present")
    notes = clip.get("notes")
    if not isinstance(notes, list):
        errors.append(f"{prefix}.notes: must be an array")
    else:
        for i, note in enumerate(notes):
            _validate_note(note, f"{prefix}.notes[{i}]", errors)


# ---------------------------------------------------------------------------
# Motif helpers
# ---------------------------------------------------------------------------

def _validate_motif(motif: object, prefix: str, errors: list[str]) -> None:
    if not isinstance(motif, dict):
        errors.append(f"{prefix}: motif must be an object")
        return
    if not _non_empty_str(motif.get("id")):
        errors.append(f"{prefix}.id: must be a non-empty string")
    notes = motif.get("notes")
    if not isinstance(notes, list):
        errors.append(f"{prefix}.notes: must be an array")
    else:
        for i, note in enumerate(notes):
            _validate_note(note, f"{prefix}.notes[{i}]", errors)
    source = motif.get("source")
    if not isinstance(source, dict):
        errors.append(f"{prefix}.source: must be an object")
    elif source.get("type") not in _VALID_SOURCE_TYPES:
        errors.append(
            f"{prefix}.source.type: must be one of {sorted(_VALID_SOURCE_TYPES)}"
        )
    ls = motif.get("lockStrength")
    if ls is not None and (not isinstance(ls, (int, float)) or not (0 <= ls <= 1)):
        errors.append(f"{prefix}.lockStrength: must be a number between 0 and 1")


# ---------------------------------------------------------------------------
# Section helpers
# ---------------------------------------------------------------------------

def _validate_section(section: object, prefix: str, errors: list[str]) -> None:
    if not isinstance(section, dict):
        errors.append(f"{prefix}: section must be an object")
        return
    if not _non_empty_str(section.get("id")):
        errors.append(f"{prefix}.id: must be a non-empty string")
    if not _non_empty_str(section.get("name")):
        errors.append(f"{prefix}.name: must be a non-empty string")
    _validate_bar_range(section.get("barRange"), f"{prefix}.barRange", errors)

    style = section.get("style")
    if not isinstance(style, dict):
        errors.append(f"{prefix}.style: must be an object")
    else:
        if not _non_empty_str(style.get("genre")):
            errors.append(f"{prefix}.style.genre: must be a non-empty string")
        energy = style.get("energy")
        if not isinstance(energy, (int, float)) or not (0 <= energy <= 1):
            errors.append(f"{prefix}.style.energy: must be a number between 0 and 1")
        instruments = style.get("instruments")
        if not isinstance(instruments, list):
            errors.append(f"{prefix}.style.instruments: must be an array")
        else:
            for i, inst in enumerate(instruments):
                if not _non_empty_str(inst):
                    errors.append(f"{prefix}.style.instruments[{i}]: must be a non-empty string")

    motif_ids = section.get("motifIds")
    if not isinstance(motif_ids, list):
        errors.append(f"{prefix}.motifIds: must be an array")
    else:
        for i, mid in enumerate(motif_ids):
            if not _non_empty_str(mid):
                errors.append(f"{prefix}.motifIds[{i}]: must be a non-empty string")

    chords = section.get("chords")
    if not isinstance(chords, list):
        errors.append(f"{prefix}.chords: must be an array")
    else:
        for i, chord in enumerate(chords):
            if not _non_empty_str(chord):
                errors.append(f"{prefix}.chords[{i}]: must be a non-empty string")

    locks = section.get("locks")
    if not isinstance(locks, dict):
        errors.append(f"{prefix}.locks: must be an object")
    else:
        for lock_name in ("melody", "rhythm", "chords", "tempo", "key"):
            if lock_name in locks and not isinstance(locks[lock_name], bool):
                errors.append(f"{prefix}.locks.{lock_name}: must be a boolean")


# ---------------------------------------------------------------------------
# Track helpers
# ---------------------------------------------------------------------------

def _validate_track(track: object, prefix: str, errors: list[str]) -> None:
    if not isinstance(track, dict):
        errors.append(f"{prefix}: track must be an object")
        return
    if not _non_empty_str(track.get("id")):
        errors.append(f"{prefix}.id: must be a non-empty string")
    if not _non_empty_str(track.get("name")):
        errors.append(f"{prefix}.name: must be a non-empty string")
    if track.get("type") != "midi":
        errors.append(f"{prefix}.type: must be 'midi'")
    if not _non_empty_str(track.get("instrument")):
        errors.append(f"{prefix}.instrument: must be a non-empty string")
    clips = track.get("clips")
    if not isinstance(clips, list):
        errors.append(f"{prefix}.clips: must be an array")
    else:
        for i, clip in enumerate(clips):
            _validate_clip(clip, f"{prefix}.clips[{i}]", errors)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_music_ir(data: dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate a Music IR dict against expected shape.

    Returns (is_valid, error_messages).
    """
    errors: list[str] = []

    if not isinstance(data, dict):
        errors.append("root: must be an object")
        return (False, errors)

    # --- Required top-level keys ---
    for key in ("schemaVersion", "projectId", "title"):
        if not _non_empty_str(str(data.get(key, ""))) if key != "schemaVersion" else data.get(key) is None:
            if key == "schemaVersion":
                errors.append(f"{key}: is required")
            else:
                errors.append(f"{key}: must be a non-empty string")

    # schemaVersion must be 1
    sv = data.get("schemaVersion")
    if sv is not None and sv != 1:
        errors.append(f"schemaVersion: must be 1, got {sv}")

    # projectId
    if "projectId" in data and not _non_empty_str(data["projectId"]):
        errors.append("projectId: must be a non-empty string")

    # title
    if "title" in data and not _non_empty_str(data["title"]):
        errors.append("title: must be a non-empty string")

    # tempo: int 40-240
    tempo = data.get("tempo")
    if tempo is None:
        errors.append("tempo: is required")
    elif not isinstance(tempo, int) or not (40 <= tempo <= 240):
        errors.append(f"tempo: must be an integer between 40 and 240, got {tempo}")

    # key
    if "key" in data and not _non_empty_str(data["key"]):
        errors.append("key: must be a non-empty string")

    # timeSignature: regex /^\d+\/\d+$/
    ts = data.get("timeSignature")
    if ts is None:
        errors.append("timeSignature: is required")
    elif not isinstance(ts, str) or not _TIME_SIG_RE.match(ts):
        errors.append(f"timeSignature: must match pattern '<n>/<m>', got {ts}")

    # sections
    sections = data.get("sections")
    if not isinstance(sections, list):
        errors.append("sections: must be an array")
    else:
        for i, section in enumerate(sections):
            _validate_section(section, f"sections[{i}]", errors)

    # motifs
    motifs = data.get("motifs")
    if not isinstance(motifs, list):
        errors.append("motifs: must be an array")
    else:
        for i, motif in enumerate(motifs):
            _validate_motif(motif, f"motifs[{i}]", errors)

    # tracks
    tracks = data.get("tracks")
    if not isinstance(tracks, list):
        errors.append("tracks: must be an array")
    else:
        for i, track in enumerate(tracks):
            _validate_track(track, f"tracks[{i}]", errors)

    return (len(errors) == 0, errors)


def validate_patch_proposal(proposal: dict[str, Any], current_ir: dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate an IrPatchProposal against schema and the current IR.

    Checks required fields, JSON patch operation validity, and musicalDiff shape.
    The current_ir parameter is passed for context but schema checks are performed
    independently; lock checking is done separately via check_lock_violations.

    Returns (is_valid, error_messages).
    """
    errors: list[str] = []

    _ = current_ir  # reserved for future cross-validation (e.g., projectId match)

    if not isinstance(proposal, dict):
        errors.append("root: proposal must be an object")
        return (False, errors)

    # Required top-level fields
    for field in ("proposalId", "projectId", "summary"):
        val = proposal.get(field)
        if not _non_empty_str(val):
            errors.append(f"{field}: must be a non-empty string")

    # patch must be array of JSON patch ops
    patch = proposal.get("patch")
    if not isinstance(patch, list):
        errors.append("patch: must be an array")
    else:
        for i, op in enumerate(patch):
            if not isinstance(op, dict):
                errors.append(f"patch[{i}]: must be an object")
                continue
            op_type = op.get("op")
            if op_type not in _VALID_PATCH_OPS:
                errors.append(
                    f"patch[{i}].op: must be one of {sorted(_VALID_PATCH_OPS)}, got {op_type!r}"
                )
            path = op.get("path", "")
            if not isinstance(path, str) or not path.startswith("/"):
                errors.append(f"patch[{i}].path: must start with '/', got {path!r}")

    # musicalDiff
    musical_diff = proposal.get("musicalDiff")
    if not isinstance(musical_diff, dict):
        errors.append("musicalDiff: must be an object")
    else:
        nd = ("notesAdded", "notesRemoved")
        for field_name in nd:
            val = musical_diff.get(field_name)
            if not isinstance(val, int) or val < 0:
                errors.append(f"musicalDiff.{field_name}: must be a non-negative integer")

        # barsChanged (optional)
        if "barsChanged" in musical_diff:
            _validate_bar_range(musical_diff["barsChanged"], "musicalDiff.barsChanged", errors)

        # preservedMotifs (optional, defaults to [])
        pm = musical_diff.get("preservedMotifs")
        if pm is not None:
            if not isinstance(pm, list):
                errors.append("musicalDiff.preservedMotifs: must be an array")
            else:
                for i, m in enumerate(pm):
                    if not _non_empty_str(m):
                        errors.append(f"musicalDiff.preservedMotifs[{i}]: must be a non-empty string")

    return (len(errors) == 0, errors)


# ---------------------------------------------------------------------------
# Lock checking
# ---------------------------------------------------------------------------

def check_lock_violations(proposal: dict[str, Any], current_ir: dict[str, Any]) -> list[str]:
    """Check if a patch proposal violates any section locks.

    For each section in current_ir with locks:
      - melody=true   -> reject patches to notes in that section
      - rhythm=true   -> reject patches to note durations or startBeats
      - chords=true   -> reject patches to chord field
      - tempo=true    -> reject patches to tempo
      - key=true      -> reject patches to key

    Paths are inspected from the proposal's JSON patch operations.
    Returns a list of human-readable violation messages (empty = no violations).
    """
    violations: list[str] = []

    sections = current_ir.get("sections")
    if not isinstance(sections, list):
        return violations

    patch = proposal.get("patch")
    if not isinstance(patch, list):
        return violations

    for op in patch:
        if not isinstance(op, dict):
            continue
        path: str = op.get("path", "")

        # Global locks: tempo and key
        if path == "/tempo":
            for idx, section in enumerate(sections):
                locks = section.get("locks", {})
                if locks.get("tempo") is True:
                    violations.append(
                        f"Section '{section.get('id', idx)}' has tempo lock: "
                        f"patch to /tempo is rejected"
                    )

        if path == "/key":
            for idx, section in enumerate(sections):
                locks = section.get("locks", {})
                if locks.get("key") is True:
                    violations.append(
                        f"Section '{section.get('id', idx)}' has key lock: "
                        f"patch to /key is rejected"
                    )

        # Section-scoped locks: melody, rhythm, chords
        # Paths look like /sections/<index>/...
        m = re.match(r"^/sections/(\d+)(/.*)?$", path)
        if not m:
            continue

        section_idx = int(m.group(1))
        remainder = m.group(2) or ""

        if section_idx >= len(sections):
            continue

        section = sections[section_idx]
        locks = section.get("locks", {})
        section_id = section.get("id", section_idx)

        # chords lock
        if locks.get("chords") is True and remainder == "/chords":
            violations.append(
                f"Section '{section_id}' has chords lock: "
                f"patch to {path!r} is rejected"
            )

        # melody lock — patches to /notes/... within a section
        if locks.get("melody") is True:
            if re.search(r"/notes/", remainder):
                violations.append(
                    f"Section '{section_id}' has melody lock: "
                    f"patch to {path!r} is rejected"
                )

        # rhythm lock — patches to note duration or startBeat
        if locks.get("rhythm") is True:
            if "/durationBeats" in remainder or "/startBeats" in remainder:
                violations.append(
                    f"Section '{section_id}' has rhythm lock: "
                    f"patch to {path!r} is rejected"
                )

    return violations
