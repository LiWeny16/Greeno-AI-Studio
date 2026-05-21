"""Tool definitions and dispatch for the agent loop.

Tools are Python functions that the agent can call during a ReAct loop.
Each tool is registered via decorator with a name, description, and
JSON Schema for LLM function calling. All tools are deterministic for
known fixture inputs and never mutate project state directly.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Any, Callable

from cc_music.music.ir import (
    IrPatchProposal,
    MusicIr,
)


# ---------------------------------------------------------------------------
# Pitch utilities
# ---------------------------------------------------------------------------

_NOTE_TO_SEMITONE: dict[str, int] = {
    "C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11,
}
_SEMITONE_TO_NOTE: list[str] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
]

_PITCH_RE = re.compile(r"^([A-G])([#b]?)(\d+)$")


def pitch_to_midi(pitch: str) -> int:
    """Convert pitch name (e.g. 'A4', 'C#5', 'Eb3') to MIDI note number."""
    m = _PITCH_RE.match(pitch)
    if not m:
        raise ValueError(f"Invalid pitch: {pitch}")
    note, accidental, octave = m.groups()
    base = _NOTE_TO_SEMITONE[note]
    if accidental == "#":
        base += 1
    elif accidental == "b":
        base -= 1
    return (int(octave) + 1) * 12 + base


def midi_to_pitch(midi: int) -> str:
    """Convert MIDI note number to pitch name (uses sharps)."""
    octave = (midi // 12) - 1
    note = _SEMITONE_TO_NOTE[midi % 12]
    return f"{note}{octave}"


# ---------------------------------------------------------------------------
# Chord utilities
# ---------------------------------------------------------------------------

_CHORD_QUALITIES: dict[str, str] = {
    "": "major",
    "m": "minor",
    "dim": "diminished",
    "aug": "augmented",
    "7": "dominant_seventh",
    "maj7": "major_seventh",
    "m7": "minor_seventh",
}

_CHORD_ROOT_SEMITONES: dict[str, int] = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}


def parse_chord_symbol(symbol: str) -> dict:
    """Parse a chord symbol into root and quality dict."""
    m = re.match(r"^([A-G][#b]?)(maj7|m7|dim|aug|m|7)?$", symbol)
    if not m:
        return {"root": symbol, "quality": "unknown"}
    root = m.group(1)
    qual_suffix = m.group(2) or ""
    quality = _CHORD_QUALITIES.get(qual_suffix, "unknown")
    return {"root": root, "quality": quality}


def chord_root_semitone(root: str) -> int:
    """Return the MIDI semitone value for a chord root name."""
    return _CHORD_ROOT_SEMITONES.get(root, 0)


def _extract_tonic(key_str: str) -> str:
    """Extract tonic note name from a key string like 'A minor' or 'C'."""
    return key_str.split()[0]


# ---------------------------------------------------------------------------
# Cadence detection
# ---------------------------------------------------------------------------

def _detect_cadences(
    parsed_chords: list[dict],
    chord_symbols: list[str],
    key_str: str,
) -> list[dict]:
    """Detect standard cadences in a chord progression.

    Considers the stated key and its relative major/minor so that
    common progressions (e.g. iv-VII-III-VII in minor, which is
    IV-V-I-V in the relative major) are detected.
    """
    tonic_name = _extract_tonic(key_str)
    tonic_semi = chord_root_semitone(tonic_name) % 12
    is_minor = "minor" in key_str.lower() or "min" in key_str.lower()

    # Try both the stated tonic and its relative (3 semitones away).
    candidates: set[int] = {tonic_semi}
    candidates.add((tonic_semi + 3) % 12 if is_minor else (tonic_semi - 3) % 12)

    cadences: list[dict] = []

    for i in range(len(parsed_chords) - 1):
        curr_semi = chord_root_semitone(parsed_chords[i]["root"]) % 12
        next_semi = chord_root_semitone(parsed_chords[i + 1]["root"]) % 12

        for tonic_ref in candidates:
            v_semi = (tonic_ref + 7) % 12
            iv_semi = (tonic_ref + 5) % 12
            vi_semi = (tonic_ref + 9) % 12

            if curr_semi == v_semi and next_semi == tonic_ref:
                cadences.append({"type": "authentic", "bar": i + 1})
            elif curr_semi == iv_semi and next_semi == tonic_ref:
                cadences.append({"type": "plagal", "bar": i + 1})
            elif curr_semi == v_semi and next_semi == vi_semi:
                cadences.append({"type": "deceptive", "bar": i + 1})

    # Half cadence: last chord root is V relative to any candidate tonic.
    if parsed_chords:
        last_semi = chord_root_semitone(parsed_chords[-1]["root"]) % 12
        for tonic_ref in candidates:
            v_semi = (tonic_ref + 7) % 12
            if last_semi == v_semi:
                cadences.append({"type": "half", "bar": len(parsed_chords)})
                break

    return cadences


# ---------------------------------------------------------------------------
# Tool types
# ---------------------------------------------------------------------------

@dataclass
class SimpleTool:
    """A registered tool wrapping a handler function."""

    name: str
    description: str
    parameters: dict
    handler: Callable

    async def execute(self, args: dict, ctx: dict) -> dict:
        return await self.handler(args, ctx)


TOOL_REGISTRY: dict[str, SimpleTool] = {}


def register(name: str, description: str, parameters: dict):
    """Decorator to register an async handler as a tool."""

    def decorator(fn):
        TOOL_REGISTRY[name] = SimpleTool(
            name=name,
            description=description,
            parameters=parameters,
            handler=fn,
        )
        return fn

    return decorator


async def dispatch_tool(name: str, args: dict, ctx: dict) -> dict:
    """Find tool by name, execute, and return a result dict.  Catch errors."""
    tool = TOOL_REGISTRY.get(name)
    if tool is None:
        return {"success": False, "error": f"Unknown tool: {name}"}
    try:
        return await tool.execute(args or {}, ctx or {})
    except Exception as exc:
        return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# JSON Schema parameter definitions for LLM function calling
# ---------------------------------------------------------------------------

_READ_IR_PARAMS: dict = {
    "type": "object",
    "properties": {
        "bar_range": {
            "type": "array",
            "items": {"type": "integer"},
            "minItems": 2,
            "maxItems": 2,
        },
        "section_id": {"type": "string"},
    },
}

_ANALYZE_MOTIF_PARAMS: dict = {
    "type": "object",
    "required": ["motif_id"],
    "properties": {
        "motif_id": {"type": "string"},
    },
}

_ANALYZE_CHORDS_PARAMS: dict = {
    "type": "object",
    "required": ["section_id"],
    "properties": {
        "section_id": {"type": "string"},
    },
}

_GEN_VARIATION_PARAMS: dict = {
    "type": "object",
    "required": ["motif_id", "variation_type"],
    "properties": {
        "motif_id": {"type": "string"},
        "variation_type": {
            "type": "string",
            "enum": [
                "transpose",
                "invert",
                "retrograde",
                "rhythm_augment",
                "rhythm_diminish",
            ],
        },
    },
}

_GEN_COUNTER_PARAMS: dict = {
    "type": "object",
    "required": ["motif_id"],
    "properties": {
        "motif_id": {"type": "string"},
        "species": {"type": "string", "enum": ["first", "second", "fifth"]},
    },
}

_GEN_BASSLINE_PARAMS: dict = {
    "type": "object",
    "required": ["chord_progression"],
    "properties": {
        "chord_progression": {"type": "array", "items": {"type": "string"}},
        "style": {
            "type": "string",
            "enum": ["walking", "root_fifth", "arpeggiated", "pedal"],
        },
    },
}

_GEN_DRUM_PARAMS: dict = {
    "type": "object",
    "required": ["style"],
    "properties": {
        "style": {
            "type": "string",
            "enum": ["rock", "jazz_swing", "electronic", "hip_hop", "latin"],
        },
        "bars": {"type": "integer", "minimum": 1},
        "time_signature": {"type": "string"},
    },
}

_VALIDATE_PATCH_PARAMS: dict = {
    "type": "object",
    "required": ["proposal"],
    "properties": {"proposal": {"type": "object"}},
}

_CHECK_LOCKS_PARAMS: dict = {
    "type": "object",
    "required": ["proposal"],
    "properties": {"proposal": {"type": "object"}},
}

_BUILD_PATCH_PARAMS: dict = {
    "type": "object",
    "required": ["operations"],
    "properties": {
        "operations": {"type": "array", "items": {"type": "object"}},
        "description": {"type": "string"},
        "tool_outputs": {"type": "object"},
    },
}


# ===================================================================
# Tool 1: read_ir_section
# ===================================================================

@register(
    "read_ir_section",
    "Return full Music IR data (notes, motifs, chords, style, locks) for a bar range or section",
    _READ_IR_PARAMS,
)
async def read_ir_section(args: dict, ctx: dict) -> dict:
    """Read-only: return structured IR data filtered by bar_range or section_id."""
    snapshot = ctx.get("snapshot") or args.get("snapshot", {})
    if not snapshot:
        return {"success": False, "error": "No snapshot provided in context or args"}

    ir = MusicIr.model_validate(snapshot)

    bar_range = args.get("bar_range")
    section_id = args.get("section_id")

    matching_sections = ir.sections
    if section_id:
        matching_sections = [s for s in matching_sections if s.id == section_id]
    elif bar_range and len(bar_range) == 2:
        start, end = bar_range
        matching_sections = [
            s
            for s in matching_sections
            if s.barRange[0] <= end and s.barRange[1] >= start
        ]

    # Collect motif IDs referenced by matching sections.
    motif_ids: set[str] = set()
    for s in matching_sections:
        motif_ids.update(s.motifIds)
    matching_motifs = [m.model_dump() for m in ir.motifs if m.id in motif_ids]

    # Collect notes from clips.
    all_notes: list[dict] = []
    for t in ir.tracks:
        for clip in t.clips:
            for n in clip.notes:
                all_notes.append(n.model_dump())

    # Collect chords.
    chords: list[str] = []
    for s in matching_sections:
        chords.extend(s.chords)

    # Build style and locks per matching section.
    styles: list[dict] = []
    locks_info: list[dict] = []
    for s in matching_sections:
        styles.append({
            "section_id": s.id,
            "section_name": s.name,
            "genre": s.style.genre,
            "energy": s.style.energy,
            "instruments": s.style.instruments,
        })
        locks_info.append({
            "section_id": s.id,
            "melody": s.locks.melody,
            "rhythm": s.locks.rhythm,
            "chords": s.locks.chords,
            "tempo": s.locks.tempo,
            "key": s.locks.key,
        })

    return {
        "success": True,
        "data": {
            "notes": all_notes,
            "motifs": matching_motifs,
            "chords": chords,
            "style": styles,
            "locks": locks_info,
        },
    }


# ===================================================================
# Tool 2: analyze_motif
# ===================================================================

@register(
    "analyze_motif",
    "Extract motif properties: pitch contour, rhythm pattern, intervals, register range",
    _ANALYZE_MOTIF_PARAMS,
)
async def analyze_motif(args: dict, ctx: dict) -> dict:
    """Analyze a single motif and return its musical properties."""
    motif_id = args.get("motif_id")
    if not motif_id:
        return {"success": False, "error": "motif_id is required"}

    snapshot = args.get("snapshot") or ctx.get("snapshot", {})
    if not snapshot:
        return {"success": False, "error": "No snapshot provided"}

    ir = MusicIr.model_validate(snapshot)
    motif = next((m for m in ir.motifs if m.id == motif_id), None)
    if motif is None:
        return {"success": False, "error": f"Motif '{motif_id}' not found"}

    if not motif.notes:
        return {
            "success": True,
            "data": {
                "pitch_contour": [],
                "rhythm_pattern": [],
                "intervals": [],
                "register": [0, 0],
                "note_count": 0,
            },
        }

    pitches_midi = [pitch_to_midi(n.pitch) for n in motif.notes]

    # Pitch contour: semitone offset from the first pitch.
    reference = pitches_midi[0]
    pitch_contour = [p - reference for p in pitches_midi]

    # Rhythm pattern: list of durations.
    rhythm_pattern = [n.durationBeats for n in motif.notes]

    # Intervals: stepwise pitch differences between consecutive notes.
    intervals = [
        pitches_midi[i + 1] - pitches_midi[i] for i in range(len(pitches_midi) - 1)
    ]

    register = [min(pitches_midi), max(pitches_midi)]

    return {
        "success": True,
        "data": {
            "pitch_contour": pitch_contour,
            "rhythm_pattern": rhythm_pattern,
            "intervals": intervals,
            "register": register,
            "note_count": len(motif.notes),
        },
    }


# ===================================================================
# Tool 3: analyze_chord_progression
# ===================================================================

@register(
    "analyze_chord_progression",
    "Identify chords in a section, detect cadences, and map chord tones",
    _ANALYZE_CHORDS_PARAMS,
)
async def analyze_chord_progression(args: dict, ctx: dict) -> dict:
    """Analyze a section's chord progression."""
    section_id = args.get("section_id")
    if not section_id:
        return {"success": False, "error": "section_id is required"}

    snapshot = args.get("snapshot") or ctx.get("snapshot", {})
    if not snapshot:
        return {"success": False, "error": "No snapshot provided"}

    ir = MusicIr.model_validate(snapshot)
    section = next((s for s in ir.sections if s.id == section_id), None)
    if section is None:
        return {"success": False, "error": f"Section '{section_id}' not found"}

    beats_per_bar = 4

    parsed: list[dict] = []
    for i, symbol in enumerate(section.chords):
        info = parse_chord_symbol(symbol)
        parsed.append({
            "root": info["root"],
            "quality": info["quality"],
            "inversion": "root",
            "start_beat": float(i * beats_per_bar),
            "duration": float(beats_per_bar),
        })

    cadences = _detect_cadences(parsed, list(section.chords), ir.key)

    return {
        "success": True,
        "data": {
            "chords": parsed,
            "cadences": cadences,
            "key": ir.key,
        },
    }


# ===================================================================
# Tool 4: generate_motif_variation
# ===================================================================

@register(
    "generate_motif_variation",
    "Create a new motif variant: transpose, invert, retrograde, or rhythm change",
    _GEN_VARIATION_PARAMS,
)
async def generate_motif_variation(args: dict, ctx: dict) -> dict:
    """Generate a deterministic variation of an existing motif."""
    motif_id = args.get("motif_id")
    variation_type = args.get("variation_type")

    if not motif_id:
        return {"success": False, "error": "motif_id is required"}
    if not variation_type:
        return {"success": False, "error": "variation_type is required"}

    snapshot = args.get("snapshot") or ctx.get("snapshot", {})
    if not snapshot:
        return {"success": False, "error": "No snapshot provided"}

    ir = MusicIr.model_validate(snapshot)
    motif = next((m for m in ir.motifs if m.id == motif_id), None)
    if motif is None:
        return {"success": False, "error": f"Motif '{motif_id}' not found"}
    if not motif.notes:
        return {"success": False, "error": "Motif has no notes"}

    new_notes: list[dict] = []
    new_id = f"{motif_id}_{variation_type}"

    if variation_type == "transpose":
        # Transpose up a perfect fifth (7 semitones).
        for n in motif.notes:
            midi = pitch_to_midi(n.pitch)
            new_notes.append({
                "pitch": midi_to_pitch(midi + 7),
                "startBeat": n.startBeat,
                "durationBeats": n.durationBeats,
                "velocity": n.velocity,
            })

    elif variation_type == "invert":
        # Invert around the first note's pitch (mirror).
        pivot = pitch_to_midi(motif.notes[0].pitch)
        for n in motif.notes:
            midi = pitch_to_midi(n.pitch)
            inverted = pivot - (midi - pivot)
            new_notes.append({
                "pitch": midi_to_pitch(inverted),
                "startBeat": n.startBeat,
                "durationBeats": n.durationBeats,
                "velocity": n.velocity,
            })

    elif variation_type == "retrograde":
        # Reverse note order, recompute start times.
        reversed_notes = list(reversed(motif.notes))
        cum_time = 0.0
        for n in reversed_notes:
            new_notes.append({
                "pitch": n.pitch,
                "startBeat": cum_time,
                "durationBeats": n.durationBeats,
                "velocity": n.velocity,
            })
            cum_time += n.durationBeats

    elif variation_type == "rhythm_augment":
        # Double all durations.
        cum_time = 0.0
        for n in motif.notes:
            new_notes.append({
                "pitch": n.pitch,
                "startBeat": cum_time,
                "durationBeats": round(n.durationBeats * 2, 4),
                "velocity": n.velocity,
            })
            cum_time += n.durationBeats * 2

    elif variation_type == "rhythm_diminish":
        # Halve all durations.
        cum_time = 0.0
        for n in motif.notes:
            new_notes.append({
                "pitch": n.pitch,
                "startBeat": cum_time,
                "durationBeats": round(n.durationBeats / 2, 4),
                "velocity": n.velocity,
            })
            cum_time += n.durationBeats / 2

    else:
        return {"success": False, "error": f"Unknown variation type: {variation_type}"}

    new_motif: dict = {
        "id": new_id,
        "notes": new_notes,
        "metadata": {
            "source_motif_id": motif_id,
            "variation_type": variation_type,
        },
    }

    return {"success": True, "data": {"motif": new_motif}}


# ===================================================================
# Tool 5: generate_counter_melody
# ===================================================================

@register(
    "generate_counter_melody",
    "Create counter-melody against an existing motif using species counterpoint rules",
    _GEN_COUNTER_PARAMS,
)
async def generate_counter_melody(args: dict, ctx: dict) -> dict:
    """Generate a counter-melody using species counterpoint."""
    motif_id = args.get("motif_id")
    species = args.get("species", "first")

    if not motif_id:
        return {"success": False, "error": "motif_id is required"}

    snapshot = args.get("snapshot") or ctx.get("snapshot", {})
    if not snapshot:
        return {"success": False, "error": "No snapshot provided"}

    ir = MusicIr.model_validate(snapshot)
    motif = next((m for m in ir.motifs if m.id == motif_id), None)
    if motif is None:
        return {"success": False, "error": f"Motif '{motif_id}' not found"}
    if not motif.notes:
        return {"success": False, "error": "Motif has no notes"}

    new_notes: list[dict] = []
    counter_id = f"{motif_id}_counter_{species}"

    if species == "first":
        # Note-against-note: one counter-note per original note at a third above.
        for n in motif.notes:
            midi = pitch_to_midi(n.pitch)
            new_notes.append({
                "pitch": midi_to_pitch(midi + 4),
                "startBeat": n.startBeat,
                "durationBeats": n.durationBeats,
                "velocity": round(n.velocity * 0.85, 2),
            })

    elif species == "second":
        # Two-against-one: two counter-notes per original note.
        for n in motif.notes:
            midi = pitch_to_midi(n.pitch)
            half_dur = n.durationBeats / 2
            new_notes.append({
                "pitch": midi_to_pitch(midi + 4),
                "startBeat": n.startBeat,
                "durationBeats": half_dur,
                "velocity": round(n.velocity * 0.8, 2),
            })
            new_notes.append({
                "pitch": midi_to_pitch(midi + 7),
                "startBeat": n.startBeat + half_dur,
                "durationBeats": half_dur,
                "velocity": round(n.velocity * 0.8, 2),
            })

    elif species == "fifth":
        # Florid: three notes per original note with varied intervals.
        for n in motif.notes:
            midi = pitch_to_midi(n.pitch)
            third_dur = n.durationBeats / 3
            new_notes.append({
                "pitch": midi_to_pitch(midi + 3),
                "startBeat": n.startBeat,
                "durationBeats": round(third_dur, 4),
                "velocity": round(n.velocity * 0.75, 2),
            })
            new_notes.append({
                "pitch": midi_to_pitch(midi + 5),
                "startBeat": n.startBeat + third_dur,
                "durationBeats": round(third_dur, 4),
                "velocity": round(n.velocity * 0.7, 2),
            })
            new_notes.append({
                "pitch": midi_to_pitch(midi + 4),
                "startBeat": n.startBeat + 2 * third_dur,
                "durationBeats": round(third_dur, 4),
                "velocity": round(n.velocity * 0.8, 2),
            })

    else:
        return {"success": False, "error": f"Unknown species: {species}"}

    counter_motif: dict = {
        "id": counter_id,
        "notes": new_notes,
    }

    return {"success": True, "data": {"counter_motif": counter_motif}}


# ===================================================================
# Tool 6: generate_bassline
# ===================================================================

def _chord_root_midi(chord_symbol: str) -> int:
    """Return the MIDI number for a chord root in the bass register (C2-C4)."""
    info = parse_chord_symbol(chord_symbol)
    semitone = chord_root_semitone(info["root"])
    return 36 + semitone  # C2 = 36


@register(
    "generate_bassline",
    "Create a bassline following a chord progression in a given style",
    _GEN_BASSLINE_PARAMS,
)
async def generate_bassline(args: dict, ctx: dict) -> dict:
    """Generate a deterministic bassline from a chord progression."""
    chord_progression = args.get("chord_progression", [])
    style = args.get("style", "root_fifth")

    if not chord_progression:
        return {"success": False, "error": "chord_progression is required and must be non-empty"}

    new_notes: list[dict] = []
    bassline_id = f"bassline_{style}"

    if style == "root_fifth":
        for i, chord in enumerate(chord_progression):
            root_midi = _chord_root_midi(chord)
            new_notes.append({
                "pitch": midi_to_pitch(root_midi),
                "startBeat": i * 4.0,
                "durationBeats": 2.0,
                "velocity": 0.9,
            })
            new_notes.append({
                "pitch": midi_to_pitch(root_midi + 7),
                "startBeat": i * 4.0 + 2.0,
                "durationBeats": 2.0,
                "velocity": 0.8,
            })

    elif style == "walking":
        for i, chord in enumerate(chord_progression):
            root_midi = _chord_root_midi(chord)
            steps = [0, 2, 4, 5]  # root, major 2nd, major 3rd, perfect 4th
            for j, step in enumerate(steps):
                new_notes.append({
                    "pitch": midi_to_pitch(root_midi + step),
                    "startBeat": i * 4.0 + j * 1.0,
                    "durationBeats": 1.0,
                    "velocity": 0.85,
                })

    elif style == "arpeggiated":
        for i, chord in enumerate(chord_progression):
            root_midi = _chord_root_midi(chord)
            arp = [0, 4, 7, 12]  # root, 3rd, 5th, octave
            for j, interval in enumerate(arp):
                new_notes.append({
                    "pitch": midi_to_pitch(root_midi + interval),
                    "startBeat": i * 4.0 + j * 1.0,
                    "durationBeats": 1.0,
                    "velocity": 0.8,
                })

    elif style == "pedal":
        for i, chord in enumerate(chord_progression):
            root_midi = _chord_root_midi(chord)
            new_notes.append({
                "pitch": midi_to_pitch(root_midi),
                "startBeat": i * 4.0,
                "durationBeats": 4.0,
                "velocity": 0.85,
            })

    else:
        return {"success": False, "error": f"Unknown bassline style: {style}"}

    bassline: dict = {
        "id": bassline_id,
        "notes": new_notes,
    }

    return {"success": True, "data": {"bassline": bassline}}


# ===================================================================
# Tool 7: generate_drum_pattern
# ===================================================================

_DRUM_PATTERNS: dict[str, dict[str, list[float]]] = {
    "rock": {
        "kick": [0.0, 1.0, 2.0, 2.75],
        "snare": [1.0, 3.0],
        "hihat_closed": [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
        "crash": [0.0],
    },
    "jazz_swing": {
        "kick": [0.0, 2.0],
        "snare": [1.33, 3.33],
        "hihat_closed": [0.0, 0.67, 1.33, 2.0, 2.67, 3.33],
        "ride": [0.0, 0.67, 1.33, 2.0, 2.67, 3.33],
        "hihat_open": [0.67, 2.67],
    },
    "electronic": {
        "kick": [0.0, 0.75, 1.5, 2.0, 2.75, 3.5],
        "snare": [1.0, 3.0],
        "hihat_closed": [
            0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75,
            2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75,
        ],
        "hihat_open": [0.5, 2.5],
        "clap": [1.0, 3.0],
    },
    "hip_hop": {
        "kick": [0.0, 1.0, 2.0, 2.5],
        "snare": [1.0, 3.0],
        "hihat_closed": [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
        "hihat_open": [0.25, 2.25, 3.75],
    },
    "latin": {
        "kick": [0.0, 2.0, 3.0],
        "snare": [1.0, 3.0],
        "hihat_closed": [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
        "tom_high": [0.5, 2.5],
        "tom_low": [1.5, 3.5],
        "crash": [0.0],
    },
}

# Higher-velocity drums
_HIGH_VELOCITY_DRUMS = frozenset({"kick", "snare", "crash"})


@register(
    "generate_drum_pattern",
    "Create a rhythm pattern for a drum track in a given style",
    _GEN_DRUM_PARAMS,
)
async def generate_drum_pattern(args: dict, ctx: dict) -> dict:
    """Generate a deterministic drum pattern for a given style."""
    style = args.get("style", "rock")
    bars = args.get("bars", 1)
    time_signature = args.get("time_signature", "4/4")

    if style not in _DRUM_PATTERNS:
        return {"success": False, "error": f"Unknown drum style: {style}"}

    pattern = _DRUM_PATTERNS[style]
    beats_per_bar = 4
    hits: list[dict] = []

    for bar in range(bars):
        offset = bar * beats_per_bar
        for drum_type, positions in pattern.items():
            for pos in positions:
                hits.append({
                    "drum_type": drum_type,
                    "beat": round(offset + pos, 2),
                    "velocity": 0.9 if drum_type in _HIGH_VELOCITY_DRUMS else 0.7,
                })

    pattern_data: dict = {
        "id": f"drum_{style}",
        "hits": hits,
    }

    return {"success": True, "data": {"pattern": pattern_data}}


# ===================================================================
# Tool 8: validate_patch_schema
# ===================================================================

_VALID_OPS: frozenset[str] = frozenset({"add", "remove", "replace", "move", "copy", "test"})


@register(
    "validate_patch_schema",
    "Validate a candidate IrPatchProposal against schema rules",
    _VALIDATE_PATCH_PARAMS,
)
async def validate_patch_schema(args: dict, ctx: dict) -> dict:
    """Validate the structure of an IrPatchProposal dict."""
    proposal = args.get("proposal", {})

    if not isinstance(proposal, dict):
        return {
            "success": True,
            "data": {"valid": False, "errors": ["proposal must be a dict"]},
        }

    errors: list[str] = []

    # --- top-level required fields ---
    for field in ("proposalId", "projectId", "summary"):
        if field not in proposal:
            errors.append(f"proposal missing required field '{field}'")

    # --- patch ---
    if "patch" not in proposal:
        errors.append("proposal missing required field 'patch'")
    elif not isinstance(proposal["patch"], list):
        errors.append("'patch' must be a list of RFC 6902 operations")
    else:
        for i, op in enumerate(proposal["patch"]):
            if not isinstance(op, dict):
                errors.append(f"patch[{i}] must be a dict (RFC 6902 operation)")
                continue
            if "op" not in op:
                errors.append(f"patch[{i}] missing required field 'op'")
            elif op["op"] not in _VALID_OPS:
                errors.append(
                    f"patch[{i}] has invalid op '{op.get('op')}'; "
                    f"must be one of: {', '.join(sorted(_VALID_OPS))}"
                )
            if "path" not in op:
                errors.append(f"patch[{i}] missing required field 'path'")
            elif not isinstance(op["path"], str) or not op["path"].startswith("/"):
                errors.append(f"patch[{i}] path must start with '/'")

    # --- musicalDiff ---
    if "musicalDiff" not in proposal:
        errors.append("proposal missing required field 'musicalDiff'")
    elif not isinstance(proposal["musicalDiff"], dict):
        errors.append("'musicalDiff' must be a dict")

    return {
        "success": True,
        "data": {"valid": len(errors) == 0, "errors": errors},
    }


# ===================================================================
# Tool 9: check_lock_violations
# ===================================================================

_LOCK_KEYWORDS: list[tuple[str, list[str]]] = [
    ("melody", ["melody", "notes", "pitch", "motif"]),
    ("rhythm", ["rhythm", "duration", "startbeat", "start_beat"]),
    ("chords", ["chords", "chord", "harmony"]),
    ("tempo", ["tempo"]),
    ("key", ["key"]),
]


@register(
    "check_lock_violations",
    "Verify candidate patch does not violate section/note locks",
    _CHECK_LOCKS_PARAMS,
)
async def check_lock_violations(args: dict, ctx: dict) -> dict:
    """Check if patch operations violate lock constraints on any section."""
    proposal = args.get("proposal", {})
    snapshot = args.get("snapshot") or ctx.get("snapshot", {})

    if not snapshot:
        return {"success": False, "error": "No snapshot provided"}

    ir = MusicIr.model_validate(snapshot)
    violations: list[dict] = []

    patch_ops = proposal.get("patch", [])
    if not isinstance(patch_ops, list):
        return {"success": True, "data": {"violations": []}}

    for op in patch_ops:
        op_path = op.get("path", "")
        op_type = op.get("op", "")
        path_lower = op_path.lower()

        for lock_type, keywords in _LOCK_KEYWORDS:
            if not any(kw in path_lower for kw in keywords):
                continue

            for idx, section in enumerate(ir.sections):
                if not getattr(section.locks, lock_type, False):
                    continue

                # A path targets a section if the section id or index appears.
                targets_section = (
                    section.id in op_path
                    or f"sections/{section.id}" in op_path
                    or f"sections/{idx}" in op_path
                )
                if targets_section:
                    violations.append({
                        "lock_type": lock_type,
                        "path": op_path,
                        "message": (
                            f"{op_type} on '{op_path}' violates {lock_type} lock "
                            f"on section '{section.id}'"
                        ),
                    })

    return {"success": True, "data": {"violations": violations}}


# ===================================================================
# Tool 10: build_patch_json
# ===================================================================

@register(
    "build_patch_json",
    "Assemble scattered tool outputs into a properly formatted IrPatchProposal",
    _BUILD_PATCH_PARAMS,
)
async def build_patch_json(args: dict, ctx: dict) -> dict:
    """Build a schema-valid IrPatchProposal from individual operations."""
    operations = args.get("operations", [])
    description = args.get("description", "Agent-generated patch")

    if not operations:
        return {"success": False, "error": "operations is required and must be non-empty"}
    if not isinstance(operations, list):
        return {"success": False, "error": "operations must be a list"}

    snapshot = ctx.get("snapshot") or args.get("snapshot", {})
    project_id = snapshot.get("projectId", "unknown")

    patch_ops: list[dict] = []
    notes_added = 0
    notes_removed = 0
    errors: list[str] = []

    for i, op in enumerate(operations):
        if not isinstance(op, dict):
            errors.append(f"operation[{i}] must be a dict")
            continue
        if "op" not in op:
            errors.append(f"operation[{i}] missing required field 'op'")
            continue
        if op["op"] not in _VALID_OPS:
            errors.append(f"operation[{i}] has invalid op '{op['op']}'")
            continue
        if "path" not in op:
            errors.append(f"operation[{i}] missing required field 'path'")
            continue

        if op["op"] == "add":
            notes_added += 1
        elif op["op"] == "remove":
            notes_removed += 1

        patch_ops.append({
            "op": op["op"],
            "path": op["path"],
            "value": op.get("value"),
        })

    if errors:
        return {"success": False, "error": "; ".join(errors)}

    proposal: dict = {
        "proposalId": f"patch_agent_{uuid.uuid4().hex[:8]}",
        "projectId": project_id,
        "summary": description,
        "patch": patch_ops,
        "musicalDiff": {
            "notesAdded": notes_added,
            "notesRemoved": notes_removed,
            "preservedMotifs": [],
        },
    }

    # Ensure the result is schema-valid.
    try:
        IrPatchProposal.model_validate(proposal)
    except Exception as exc:
        return {
            "success": False,
            "error": f"Generated proposal fails schema validation: {exc}",
        }

    return {"success": True, "data": {"proposal": proposal}}
