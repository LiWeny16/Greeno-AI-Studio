"""Music transforms — transpose, motif variation, quantize, etc.

All transforms operate on note/motif dicts and return new dicts.
They NEVER mutate inputs in place.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np

# ═══════════════════════════════════════════════════════════════════════════════
# MIDI Pitch tables
# ═══════════════════════════════════════════════════════════════════════════════

PITCH_TO_MIDI: dict[str, int] = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}

MIDI_TO_PITCH: dict[int, str] = {
    0: "C",
    1: "C#",
    2: "D",
    3: "D#",
    4: "E",
    5: "F",
    6: "F#",
    7: "G",
    8: "G#",
    9: "A",
    10: "A#",
    11: "B",
}

# ═══════════════════════════════════════════════════════════════════════════════
# Scales (semitones from tonic for each mode / scale type)
# ═══════════════════════════════════════════════════════════════════════════════

SCALES: dict[str, list[int]] = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "locrian": [0, 1, 3, 5, 6, 8, 10],
    "harmonic_minor": [0, 2, 3, 5, 7, 8, 11],
    "melodic_minor": [0, 2, 3, 5, 7, 9, 11],
    "pentatonic_major": [0, 2, 4, 7, 9],
    "pentatonic_minor": [0, 3, 5, 7, 10],
    "blues": [0, 3, 5, 6, 7, 10],
    "chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

# ═══════════════════════════════════════════════════════════════════════════════
# Pitch conversion helpers
# ═══════════════════════════════════════════════════════════════════════════════

_PITCH_RE = re.compile(r"^([A-Ga-g])([#b]?)(-?\d+)$")


def pitch_to_midi(pitch: str) -> int:
    """Convert a pitch string (e.g. 'C4', 'Db3', 'F#5') to a MIDI note number.

    MIDI note 60 = middle C (C4).
    """
    match = _PITCH_RE.match(pitch)
    if not match:
        raise ValueError(f"Invalid pitch format: {pitch!r}")
    letter, accidental, octave_str = match.groups()
    key = letter.upper() + (accidental.capitalize() if accidental else "")
    if key not in PITCH_TO_MIDI:
        raise ValueError(f"Invalid pitch name: {pitch!r}")
    semitone = PITCH_TO_MIDI[key]
    octave = int(octave_str)
    return (octave + 1) * 12 + semitone


def midi_to_pitch(midi: int) -> str:
    """Convert a MIDI note number to a pitch string (e.g. 60 -> 'C4')."""
    octave = midi // 12 - 1
    idx = midi % 12
    return f"{MIDI_TO_PITCH[idx]}{octave}"


# ═══════════════════════════════════════════════════════════════════════════════
# Note-level transforms
# ═══════════════════════════════════════════════════════════════════════════════


def transpose_notes(notes: list[dict[str, Any]], semitones: int) -> list[dict[str, Any]]:
    """Shift every note pitch by *semitones* (positive = up, negative = down).

    Returns a new list; input notes are not mutated.
    """
    if not isinstance(semitones, int):
        raise TypeError("semitones must be an integer")
    return [
        {**note, "pitch": midi_to_pitch(pitch_to_midi(note["pitch"]) + semitones)}
        for note in notes
    ]


def quantize_notes(
    notes: list[dict[str, Any]], grid_16ths: int = 4
) -> list[dict[str, Any]]:
    """Snap note start positions and durations to a rhythmic grid.

    *grid_16ths* is the number of 16th notes per grid cell:
    - 1 = 16th note grid
    - 2 = 8th note grid
    - 4 = quarter note grid (default)
    - 8 = half note grid

    Returns a new list; input notes are not mutated.
    """
    if not isinstance(grid_16ths, int) or grid_16ths <= 0:
        raise ValueError("grid_16ths must be a positive integer")

    grid_step = grid_16ths / 4.0  # beats per grid cell

    result: list[dict[str, Any]] = []
    for note in notes:
        n = dict(note)
        start = float(n.get("startBeat", 0.0))
        duration = float(n.get("durationBeats", 0.0))

        q_start = round(start / grid_step) * grid_step
        q_end = round((start + duration) / grid_step) * grid_step

        n["startBeat"] = max(0.0, q_start)
        n["durationBeats"] = max(grid_step, q_end - q_start)
        result.append(n)

    return result


def scale_velocity(notes: list[dict[str, Any]], factor: float) -> list[dict[str, Any]]:
    """Multiply all velocities by *factor*, clamped to [0, 1].

    Returns a new list; input notes are not mutated.
    """
    if not isinstance(factor, (int, float)):
        raise TypeError("factor must be a number")
    factor = float(factor)
    if factor < 0 or not np.isfinite(factor):
        raise ValueError("factor must be a non-negative finite number")

    return [
        {
            **note,
            "velocity": float(np.clip(float(note.get("velocity", 0.0)) * factor, 0.0, 1.0)),
        }
        for note in notes
    ]


def shift_notes(
    notes: list[dict[str, Any]], offset_beats: float
) -> list[dict[str, Any]]:
    """Shift all note start positions by *offset_beats*.

    Negative results are clamped to 0.
    Returns a new list; input notes are not mutated.
    """
    if not isinstance(offset_beats, (int, float)):
        raise TypeError("offset_beats must be a number")
    offset_beats = float(offset_beats)
    if not np.isfinite(offset_beats):
        raise ValueError("offset_beats must be finite")

    return [
        {
            **note,
            "startBeat": max(0.0, float(note.get("startBeat", 0.0)) + offset_beats),
        }
        for note in notes
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# Motif-level transforms
# ═══════════════════════════════════════════════════════════════════════════════


def repeat_motif(motif: dict[str, Any], times: int) -> dict[str, Any]:
    """Duplicate the motif's note pattern *times* times, concatenated end-to-end.

    Returns a new motif dict; the input is not mutated.
    """
    if not isinstance(times, int) or times < 0:
        raise ValueError("times must be a non-negative integer")

    notes: list[dict[str, Any]] = motif.get("notes", [])

    if times == 0 or not notes:
        return {**motif, "notes": []}

    # Compute the full duration of one copy of the pattern
    pattern_duration = max(
        (float(n.get("startBeat", 0.0)) + float(n.get("durationBeats", 0.0)))
        for n in notes
    )
    if pattern_duration <= 0:
        return {**motif, "notes": []}

    repeated: list[dict[str, Any]] = []
    for i in range(times):
        offset = i * pattern_duration
        for n in notes:
            start = float(n.get("startBeat", 0.0)) + offset
            repeated.append({**n, "startBeat": start})

    return {**motif, "notes": repeated}


def invert_motif(motif: dict[str, Any], center_pitch: str) -> dict[str, Any]:
    """Invert pitch contour around *center_pitch* (e.g. 'C4').

    Every pitch P becomes center + (center - P).
    Returns a new motif dict; the input is not mutated.
    """
    center = pitch_to_midi(center_pitch)
    notes: list[dict[str, Any]] = motif.get("notes", [])

    return {
        **motif,
        "notes": [
            {
                **n,
                "pitch": midi_to_pitch(center + (center - pitch_to_midi(n["pitch"]))),
            }
            for n in notes
        ],
    }


def stretch_motif_rhythm(motif: dict[str, Any], factor: float) -> dict[str, Any]:
    """Scale all note start positions and durations by *factor*.

    Returns a new motif dict; the input is not mutated.
    """
    if not isinstance(factor, (int, float)):
        raise TypeError("factor must be a number")
    factor = float(factor)
    if not np.isfinite(factor) or factor <= 0:
        raise ValueError("factor must be a positive finite number")

    notes: list[dict[str, Any]] = motif.get("notes", [])

    return {
        **motif,
        "notes": [
            {
                **n,
                "startBeat": float(n.get("startBeat", 0.0)) * factor,
                "durationBeats": float(n.get("durationBeats", 0.0)) * factor,
            }
            for n in notes
        ],
    }


def generate_motif_variation(motif: dict[str, Any], seed: int = 0) -> dict[str, Any]:
    """Produce a deterministic variation of *motif* using a seeded RNG.

    Applies small random perturbations to pitch (octave shifts), velocity,
    and timing.  The same *seed* always produces the same result.
    Returns a new motif dict; the input is not mutated.
    """
    rng = np.random.default_rng(seed)
    notes: list[dict[str, Any]] = motif.get("notes", [])

    if not notes:
        return {**motif, "notes": []}

    variant: list[dict[str, Any]] = []
    for n in notes:
        vn = dict(n)

        # 25 % chance — octave shift up or down
        if rng.random() < 0.25:
            midi = pitch_to_midi(vn["pitch"])
            vn["pitch"] = midi_to_pitch(midi + 12 * int(rng.choice([-1, 1])))

        # 40 % chance — velocity adjustment
        if "velocity" in vn and rng.random() < 0.4:
            vel = float(vn["velocity"])
            vn["velocity"] = float(np.clip(vel * (0.7 + float(rng.random()) * 0.6), 0.0, 1.0))

        # 30 % chance — slight timing jitter (up to a 32nd note)
        if "startBeat" in vn and rng.random() < 0.3:
            vn["startBeat"] = float(
                max(0.0, float(vn["startBeat"]) + float(rng.uniform(-0.125, 0.125)))
            )

        variant.append(vn)

    return {**motif, "notes": variant}


# ═══════════════════════════════════════════════════════════════════════════════
# Scale / chord helpers
# ═══════════════════════════════════════════════════════════════════════════════


def is_note_in_scale(pitch: str, scale: str) -> bool:
    """Return True if *pitch* belongs to the pitch-class set defined by *scale*.

    *scale* must be a key in `SCALES` (e.g. 'major', 'minor', 'dorian').
    """
    if scale not in SCALES:
        raise ValueError(f"Unknown scale: {scale!r}")
    midi = pitch_to_midi(pitch)
    pitch_class = midi % 12
    return pitch_class in SCALES[scale]


def closest_scale_tone(pitch: str, scale: str) -> str:
    """Return the pitch nearest to *pitch* whose pitch class belongs to *scale*.

    Searches outward from the given pitch.  When two candidates are equally
    distant, the higher one is preferred.
    """
    if scale not in SCALES:
        raise ValueError(f"Unknown scale: {scale!r}")

    intervals = set(SCALES[scale])
    midi = pitch_to_midi(pitch)

    # Search outward in both directions; at each distance try + first
    for distance in range(13):  # max possible semitone distance within an octave
        for sign in (1, -1):
            candidate = midi + sign * distance
            if candidate < 0 or candidate > 127:
                continue
            if candidate % 12 in intervals:
                return midi_to_pitch(candidate)

    # Should be unreachable — chromatic scale includes every pitch class
    raise RuntimeError(
        f"No scale tone found for {pitch!r} in scale {scale!r}"
    )
