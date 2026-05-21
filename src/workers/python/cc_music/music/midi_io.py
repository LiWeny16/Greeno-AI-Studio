"""MIDI import/export using miditoolkit.

Reads and writes standard MIDI files (.mid).
Converts between miditoolkit objects and our Music IR dict format.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import miditoolkit

# ---------------------------------------------------------------------------
# Pitch helpers: convert between MIDI note numbers and pitch strings ("C4", "F#3")
# ---------------------------------------------------------------------------

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_NAME_TO_SEMITONE: dict[str, int] = {name: i for i, name in enumerate(_NOTE_NAMES)}


def midi_to_pitch(midi_note: int) -> str:
    """Convert a MIDI note number (0-127) to a pitch string like 'C4' or 'F#3'.

    MIDI note 60 = C4 (middle C).
    """
    if not (0 <= midi_note <= 127):
        raise ValueError(f"MIDI note out of range: {midi_note}")
    octave = (midi_note // 12) - 1
    name = _NOTE_NAMES[midi_note % 12]
    return f"{name}{octave}"


def pitch_to_midi(pitch: str) -> int:
    """Convert a pitch string like 'C4' or 'F#3' to a MIDI note number (0-127)."""
    if len(pitch) < 2:
        raise ValueError(f"Invalid pitch string: {pitch!r}")

    # Split into note name and octave: "F#3" -> ("F#", "3"), "C4" -> ("C", "4"),
    # "A-1" (special case for very low notes) -> ("A", "-1")
    if pitch[1:2] == "#":
        name = pitch[:2]  # e.g. "F#"
        octave_str = pitch[2:]
    else:
        name = pitch[:1]  # e.g. "C"
        octave_str = pitch[1:]

    if name not in _NAME_TO_SEMITONE:
        raise ValueError(f"Unknown note name in pitch: {pitch!r}")
    try:
        octave = int(octave_str)
    except ValueError:
        raise ValueError(f"Invalid octave in pitch: {pitch!r}") from None

    midi_note = (octave + 1) * 12 + _NAME_TO_SEMITONE[name]
    if not (0 <= midi_note <= 127):
        raise ValueError(f"Pitch {pitch!r} maps to out-of-range MIDI note {midi_note}")
    return midi_note


# ---------------------------------------------------------------------------
# Beat <-> tick conversion
# ---------------------------------------------------------------------------

# Default pulses-per-quarter-note used when exporting.
DEFAULT_TICKS_PER_BEAT = 480


def _ticks_to_beats(ticks: int, ticks_per_beat: int) -> float:
    """Convert MIDI ticks to beats."""
    return ticks / ticks_per_beat


def _beats_to_ticks(beats: float, ticks_per_beat: int) -> int:
    """Convert beats to MIDI ticks (rounded to nearest integer)."""
    return round(beats * ticks_per_beat)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def import_midi(filepath: str) -> dict[str, Any]:
    """Parse a .mid file into our Music IR dict.

    Returns a dict with keys:
        tempo: float                 — BPM (from first tempo event)
        time_signature: dict         — {"numerator": int, "denominator": int}
        tracks: list[dict]           — [{"name": str, "notes": [note, ...]}, ...]

    Each note dict:
        pitch: str                   — "C4", "F#3", etc.
        startBeat: float             — note-on time in beats
        durationBeats: float         — note duration in beats
        velocity: int                — 0-127

    Raises FileNotFoundError if the file doesn't exist.
    Raises ValueError or miditoolkit.MidiFileError for invalid MIDI data.
    """
    filepath_p = Path(filepath)
    if not filepath_p.is_file():
        raise FileNotFoundError(f"MIDI file not found: {filepath}")

    try:
        midi = miditoolkit.MidiFile(filepath_p)
    except Exception as exc:
        raise ValueError(f"Failed to parse MIDI file {filepath}: {exc}") from exc

    ticks_per_beat = midi.ticks_per_beat

    # ---- Extract tempo (from first tempo change, default 120) ----
    tempo = 120.0
    for msg in midi.tempo_changes:
        tempo = msg.tempo
        break

    # ---- Extract time signature (from first time sig, default 4/4) ----
    time_sig = {"numerator": 4, "denominator": 4}
    for msg in midi.time_signature_changes:
        time_sig = {"numerator": msg.numerator, "denominator": msg.denominator}
        break

    # ---- Build track list ----
    tracks: list[dict[str, Any]] = []
    for instrument in midi.instruments:
        if instrument.is_drum:
            continue  # skip drum tracks for MVP
        track_name = instrument.name.strip() if instrument.name else f"Track {len(tracks) + 1}"
        notes: list[dict[str, Any]] = []
        for note in instrument.notes:
            notes.append(
                {
                    "pitch": midi_to_pitch(note.pitch),
                    "startBeat": _ticks_to_beats(note.start, ticks_per_beat),
                    "durationBeats": _ticks_to_beats(note.end - note.start, ticks_per_beat),
                    "velocity": note.velocity,
                }
            )
        if notes:  # only include tracks that have notes
            tracks.append({"name": track_name, "notes": notes})

    return {
        "tempo": tempo,
        "time_signature": time_sig,
        "tracks": tracks,
    }


def export_midi(music_data: dict[str, Any], filepath: str) -> str:
    """Write a Music IR dict to a .mid file.

    Expects music_data with the same structure returned by import_midi:
        tempo: float (BPM)
        time_signature: {"numerator": int, "denominator": int}
        tracks: [{"name": str, "notes": [{pitch, startBeat, durationBeats, velocity}]}]

    Uses a default ticks_per_beat of 480.

    Returns the filepath on success.
    Raises ValueError for invalid input data.
    """
    ticks_per_beat = DEFAULT_TICKS_PER_BEAT

    # ---- Validate and extract top-level fields ----
    tempo = music_data.get("tempo", 120.0)
    if not isinstance(tempo, (int, float)) or tempo <= 0:
        raise ValueError(f"tempo must be a positive number, got {tempo!r}")

    ts = music_data.get("time_signature", {"numerator": 4, "denominator": 4})
    ts_num = ts.get("numerator", 4)
    ts_den = ts.get("denominator", 4)

    tracks_data = music_data.get("tracks", [])
    if not isinstance(tracks_data, list):
        raise ValueError("tracks must be a list")

    # ---- Build miditoolkit MidiFile ----
    midi = miditoolkit.MidiFile(ticks_per_beat=ticks_per_beat)

    # Add tempo change at tick 0
    midi.tempo_changes.append(
        miditoolkit.TempoChange(tempo=float(tempo), time=0)
    )

    # Add time signature at tick 0
    midi.time_signature_changes.append(
        miditoolkit.TimeSignature(numerator=ts_num, denominator=ts_den, time=0)
    )

    # ---- Convert tracks ----
    for i, track_data in enumerate(tracks_data):
        track_name = track_data.get("name", f"Track {i + 1}")
        raw_notes = track_data.get("notes", [])

        instrument = miditoolkit.Instrument(
            program=0,  # Acoustic Grand Piano — neutral default
            is_drum=False,
            name=str(track_name),
        )

        for note_data in raw_notes:
            pitch_str = note_data["pitch"]
            midi_pitch = pitch_to_midi(pitch_str)
            start_tick = _beats_to_ticks(float(note_data["startBeat"]), ticks_per_beat)
            end_tick = _beats_to_ticks(
                float(note_data["startBeat"]) + float(note_data["durationBeats"]),
                ticks_per_beat,
            )
            velocity = int(note_data.get("velocity", 64))
            velocity = max(0, min(127, velocity))

            instrument.notes.append(
                miditoolkit.Note(
                    pitch=midi_pitch,
                    start=start_tick,
                    end=end_tick,
                    velocity=velocity,
                )
            )

        midi.instruments.append(instrument)

    # ---- Write file ----
    filepath_p = Path(filepath)
    filepath_p.parent.mkdir(parents=True, exist_ok=True)
    midi.dump(filepath_p)
    return str(filepath_p)


def midi_roundtrip(filepath: str, tmpdir: str) -> bool:
    """Import a MIDI file, export it, re-import, and verify fidelity.

    Checks:
      - All note pitches are preserved.
      - Note start times are within 0.01 beats.
      - Note durations are preserved within 0.01 beats.
      - Velocity values are preserved.
      - Track names are preserved.
      - Tempo is preserved within 0.1 BPM.
      - Time signature is preserved.

    Returns True if all checks pass, False otherwise.
    """
    tmpdir_p = Path(tmpdir)
    tmpdir_p.mkdir(parents=True, exist_ok=True)

    # First import
    original = import_midi(filepath)

    # Export to temp file
    roundtrip_path = tmpdir_p / "roundtrip_test.mid"
    export_midi(original, str(roundtrip_path))

    # Re-import
    reimported = import_midi(str(roundtrip_path))

    # ---- Verify ----
    ok = True

    # Tempo
    if abs(original["tempo"] - reimported["tempo"]) > 0.1:
        ok = False

    # Time signature
    if original["time_signature"] != reimported["time_signature"]:
        ok = False

    # Track count and names
    if len(original["tracks"]) != len(reimported["tracks"]):
        ok = False
    for ot, rt in zip(original["tracks"], reimported["tracks"]):
        if ot["name"] != rt["name"]:
            ok = False

    # Notes
    for ot, rt in zip(original["tracks"], reimported["tracks"]):
        if len(ot["notes"]) != len(rt["notes"]):
            ok = False
        for on, rn in zip(ot["notes"], rt["notes"]):
            if on["pitch"] != rn["pitch"]:
                ok = False
            if abs(on["startBeat"] - rn["startBeat"]) > 0.01:
                ok = False
            if abs(on["durationBeats"] - rn["durationBeats"]) > 0.01:
                ok = False
            if on["velocity"] != rn["velocity"]:
                ok = False

    return ok
