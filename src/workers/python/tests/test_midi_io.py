"""Tests for MIDI import/export roundtrip fidelity."""

from __future__ import annotations

import tempfile
from pathlib import Path

import miditoolkit
import pytest

from cc_music.music.midi_io import (
    import_midi,
    export_midi,
    midi_roundtrip,
    midi_to_pitch,
    pitch_to_midi,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_test_midi(filepath: str) -> miditoolkit.MidiFile:
    """Create a small multi-track MIDI file programmatically for testing.

    Tempo: 100 BPM, Time sig: 7/8, PPQN: 480.
    Track 1: "Melody" — three notes with different pitches and velocities.
    Track 2: "Bass"   — two notes, lower octave.
    """
    ticks_per_beat = 480
    midi = miditoolkit.MidiFile(ticks_per_beat=ticks_per_beat)

    # Tempo: 100 BPM at tick 0
    midi.tempo_changes.append(miditoolkit.TempoChange(tempo=100.0, time=0))

    # Time signature: 7/8 at tick 0
    midi.time_signature_changes.append(
        miditoolkit.TimeSignature(numerator=7, denominator=8, time=0)
    )

    # Track 1 — Melody
    melody = miditoolkit.Instrument(program=0, is_drum=False, name="Melody")
    melody.notes = [
        miditoolkit.Note(pitch=60, start=0, end=480 * 2, velocity=100),       # C4, 2 beats
        miditoolkit.Note(pitch=64, start=480 * 2, end=480 * 3, velocity=80),   # E4, 1 beat
        miditoolkit.Note(pitch=67, start=480 * 3, end=480 * 5, velocity=110),  # G4, 2 beats
    ]
    midi.instruments.append(melody)

    # Track 2 — Bass
    bass = miditoolkit.Instrument(program=33, is_drum=False, name="Bass")
    bass.notes = [
        miditoolkit.Note(pitch=36, start=0, end=480 * 4, velocity=90),       # C2, 4 beats
        miditoolkit.Note(pitch=43, start=480 * 4, end=480 * 5, velocity=70),  # G2, 1 beat
    ]
    midi.instruments.append(bass)

    midi.dump(filepath)
    return midi


# ---------------------------------------------------------------------------
# Pitch conversion tests
# ---------------------------------------------------------------------------


class TestPitchConversion:
    def test_midi_to_pitch_middle_c(self):
        assert midi_to_pitch(60) == "C4"

    def test_midi_to_pitch_sharp(self):
        assert midi_to_pitch(54) == "F#3"

    def test_midi_to_pitch_low_a(self):
        assert midi_to_pitch(21) == "A0"

    def test_midi_to_pitch_high_c(self):
        assert midi_to_pitch(108) == "C8"

    def test_midi_to_pitch_out_of_range(self):
        with pytest.raises(ValueError, match="out of range"):
            midi_to_pitch(128)
        with pytest.raises(ValueError, match="out of range"):
            midi_to_pitch(-1)

    def test_pitch_to_midi_middle_c(self):
        assert pitch_to_midi("C4") == 60

    def test_pitch_to_midi_sharp(self):
        assert pitch_to_midi("F#3") == 54

    def test_pitch_to_midi_low_a(self):
        assert pitch_to_midi("A0") == 21

    def test_pitch_to_midi_high_c(self):
        assert pitch_to_midi("C8") == 108

    def test_pitch_roundtrip_all_midi_notes(self):
        """Every valid MIDI note 0-127 roundtrips through midi->pitch->midi."""
        for midi_note in range(128):
            pitch = midi_to_pitch(midi_note)
            assert pitch_to_midi(pitch) == midi_note, f"Failed for MIDI {midi_note} -> '{pitch}'"

    def test_pitch_to_midi_invalid(self):
        with pytest.raises(ValueError):
            pitch_to_midi("H4")
        with pytest.raises(ValueError):
            pitch_to_midi("")
        with pytest.raises(ValueError):
            pitch_to_midi("X")


# ---------------------------------------------------------------------------
# Import tests
# ---------------------------------------------------------------------------


class TestImport:
    def test_import_parses_tempo(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            assert result["tempo"] == 100.0

    def test_import_parses_time_signature(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            assert result["time_signature"] == {"numerator": 7, "denominator": 8}

    def test_import_parses_track_names(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            track_names = [t["name"] for t in result["tracks"]]
            assert track_names == ["Melody", "Bass"]

    def test_import_parses_note_pitches(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            melody_pitches = [n["pitch"] for n in result["tracks"][0]["notes"]]
            assert melody_pitches == ["C4", "E4", "G4"]
            bass_pitches = [n["pitch"] for n in result["tracks"][1]["notes"]]
            assert bass_pitches == ["C2", "G2"]

    def test_import_parses_start_beats(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            starts = [n["startBeat"] for n in result["tracks"][0]["notes"]]
            assert starts == [0.0, 2.0, 3.0]

    def test_import_parses_durations(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            durations = [n["durationBeats"] for n in result["tracks"][0]["notes"]]
            assert durations == [2.0, 1.0, 2.0]

    def test_import_parses_velocity(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.mid"
            _make_test_midi(str(path))
            result = import_midi(str(path))
            velocities = [n["velocity"] for n in result["tracks"][0]["notes"]]
            assert velocities == [100, 80, 110]

    def test_import_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            import_midi("/nonexistent/path/file.mid")

    def test_import_invalid_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "not_midi.mid"
            path.write_bytes(b"this is not a midi file")
            with pytest.raises(ValueError):
                import_midi(str(path))


# ---------------------------------------------------------------------------
# Export tests
# ---------------------------------------------------------------------------


class TestExport:
    def test_export_creates_file(self):
        data = {
            "tempo": 120.0,
            "time_signature": {"numerator": 4, "denominator": 4},
            "tracks": [
                {
                    "name": "Test",
                    "notes": [
                        {
                            "pitch": "C4",
                            "startBeat": 0.0,
                            "durationBeats": 1.0,
                            "velocity": 64,
                        }
                    ],
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "exported.mid"
            result = export_midi(data, str(path))
            assert result == str(path)
            assert path.is_file()
            assert path.stat().st_size > 0

    def test_export_invalid_tempo(self):
        data = {"tempo": 0, "time_signature": {"numerator": 4, "denominator": 4}, "tracks": []}
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "bad.mid"
            with pytest.raises(ValueError):
                export_midi(data, str(path))

    def test_export_invalid_tracks_type(self):
        data = {"tracks": "not_a_list"}
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "bad.mid"
            with pytest.raises(ValueError):
                export_midi(data, str(path))


# ---------------------------------------------------------------------------
# Roundtrip tests
# ---------------------------------------------------------------------------


class TestRoundtrip:
    def test_roundtrip_preserves_all(self):
        """Import -> Export -> Import preserves notes, tempo, track names, time sig."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "original.mid"
            _make_test_midi(str(src))
            assert midi_roundtrip(str(src), str(Path(tmpdir) / "roundtrip"))

    def test_roundtrip_single_note(self):
        """Roundtrip a minimal file with one note."""
        midi = miditoolkit.MidiFile(ticks_per_beat=480)
        midi.tempo_changes.append(miditoolkit.TempoChange(tempo=140.0, time=0))
        midi.time_signature_changes.append(
            miditoolkit.TimeSignature(numerator=3, denominator=4, time=0)
        )
        inst = miditoolkit.Instrument(program=0, is_drum=False, name="Solo")
        inst.notes = [
            miditoolkit.Note(pitch=69, start=120, end=600, velocity=127),  # A4
        ]
        midi.instruments.append(inst)

        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "solo.mid"
            midi.dump(str(src))
            assert midi_roundtrip(str(src), str(Path(tmpdir) / "roundtrip"))

    def test_roundtrip_multiple_tracks(self):
        """Roundtrip retains multiple tracks with distinct names."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "multi.mid"
            _make_test_midi(str(src))

            # First import
            original = import_midi(str(src))
            assert len(original["tracks"]) == 2
            assert original["tracks"][0]["name"] == "Melody"
            assert original["tracks"][1]["name"] == "Bass"

            # Export and re-import
            out = Path(tmpdir) / "roundtrip" / "out.mid"
            export_midi(original, str(out))
            reimported = import_midi(str(out))

            assert len(reimported["tracks"]) == 2
            assert reimported["tracks"][0]["name"] == "Melody"
            assert reimported["tracks"][1]["name"] == "Bass"

            # Compare note-level fidelity per track
            for ot, rt in zip(original["tracks"], reimported["tracks"]):
                for on, rn in zip(ot["notes"], rt["notes"]):
                    assert on["pitch"] == rn["pitch"]
                    assert abs(on["startBeat"] - rn["startBeat"]) < 0.01
                    assert abs(on["durationBeats"] - rn["durationBeats"]) < 0.01
                    assert on["velocity"] == rn["velocity"]

    def test_roundtrip_tempo_preserved(self):
        """Non-default tempo (100 BPM) survives roundtrip."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "tempo_test.mid"
            _make_test_midi(str(src))
            original = import_midi(str(src))
            assert original["tempo"] == 100.0

            out = Path(tmpdir) / "roundtrip" / "out.mid"
            export_midi(original, str(out))
            reimported = import_midi(str(out))
            assert reimported["tempo"] == pytest.approx(100.0, abs=0.1)

    def test_roundtrip_time_signature_preserved(self):
        """Non-default time signature (7/8) survives roundtrip."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "ts_test.mid"
            _make_test_midi(str(src))
            original = import_midi(str(src))
            assert original["time_signature"] == {"numerator": 7, "denominator": 8}

            out = Path(tmpdir) / "roundtrip" / "out.mid"
            export_midi(original, str(out))
            reimported = import_midi(str(out))
            assert reimported["time_signature"] == {"numerator": 7, "denominator": 8}

    def test_roundtrip_velocity_preserved(self):
        """Velocity values 100, 80, 110 survive roundtrip."""
        with tempfile.TemporaryDirectory() as tmpdir:
            src = Path(tmpdir) / "vel_test.mid"
            _make_test_midi(str(src))
            original = import_midi(str(src))
            velocities = [n["velocity"] for n in original["tracks"][0]["notes"]]

            out = Path(tmpdir) / "roundtrip" / "out.mid"
            export_midi(original, str(out))
            reimported = import_midi(str(out))
            reimported_velocities = [n["velocity"] for n in reimported["tracks"][0]["notes"]]
            assert velocities == reimported_velocities
