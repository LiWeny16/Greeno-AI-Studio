"""Tests for cc_music.music.transforms — 35+ tests covering all functions, edge
cases, and immutability guarantees.
"""

import copy
import math

import numpy as np
import pytest

from cc_music.music.transforms import (
    MIDI_TO_PITCH,
    PITCH_TO_MIDI,
    SCALES,
    closest_scale_tone,
    generate_motif_variation,
    invert_motif,
    is_note_in_scale,
    midi_to_pitch,
    pitch_to_midi,
    quantize_notes,
    repeat_motif,
    scale_velocity,
    shift_notes,
    stretch_motif_rhythm,
    transpose_notes,
)

# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def simple_notes() -> list[dict]:
    return [
        {"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.8},
        {"pitch": "E4", "startBeat": 1.0, "durationBeats": 0.5, "velocity": 0.6},
        {"pitch": "G4", "startBeat": 2.0, "durationBeats": 1.0, "velocity": 0.9},
    ]


@pytest.fixture
def simple_motif() -> dict:
    return {
        "id": "motif-1",
        "notes": [
            {"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.8},
            {"pitch": "D4", "startBeat": 1.0, "durationBeats": 0.5, "velocity": 0.6},
            {"pitch": "E4", "startBeat": 2.0, "durationBeats": 1.0, "velocity": 0.9},
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# pitch_to_midi / midi_to_pitch
# ═══════════════════════════════════════════════════════════════════════════════


class TestPitchToMidi:
    def test_middle_c(self) -> None:
        assert pitch_to_midi("C4") == 60

    def test_sharp_notes(self) -> None:
        assert pitch_to_midi("C#4") == 61
        assert pitch_to_midi("D#4") == 63
        assert pitch_to_midi("F#4") == 66
        assert pitch_to_midi("G#4") == 68
        assert pitch_to_midi("A#4") == 70

    def test_flat_notes(self) -> None:
        assert pitch_to_midi("Db4") == 61
        assert pitch_to_midi("Eb4") == 63
        assert pitch_to_midi("Gb4") == 66
        assert pitch_to_midi("Ab4") == 68
        assert pitch_to_midi("Bb4") == 70

    def test_low_octave(self) -> None:
        assert pitch_to_midi("C0") == 12
        assert pitch_to_midi("C-1") == 0

    def test_high_octave(self) -> None:
        assert pitch_to_midi("C8") == 108
        assert pitch_to_midi("G9") == 127

    def test_invalid_format_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid pitch format"):
            pitch_to_midi("C")
        with pytest.raises(ValueError, match="Invalid pitch format"):
            pitch_to_midi("H4")
        with pytest.raises(ValueError, match="Invalid pitch format"):
            pitch_to_midi("4C")

    def test_invalid_accidental_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid pitch format"):
            pitch_to_midi("Cx4")


class TestMidiToPitch:
    def test_middle_c(self) -> None:
        assert midi_to_pitch(60) == "C4"

    def test_lowest_midi(self) -> None:
        assert midi_to_pitch(0) == "C-1"

    def test_highest_midi(self) -> None:
        assert midi_to_pitch(127) == "G9"

    def test_sharp_names(self) -> None:
        assert midi_to_pitch(61) == "C#4"
        assert midi_to_pitch(63) == "D#4"
        assert midi_to_pitch(66) == "F#4"


class TestPitchMidiRoundtrip:
    @pytest.mark.parametrize(
        "pitch",
        ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"],
    )
    def test_roundtrip_sharps(self, pitch: str) -> None:
        """Sharp-only roundtrip must be identity (midi_to_pitch uses sharps)."""
        assert midi_to_pitch(pitch_to_midi(pitch)) == pitch

    def test_flat_pitches_produce_correct_midi(self) -> None:
        """Flat names parse to the same MIDI as their enharmonic sharp."""
        assert pitch_to_midi("Db4") == 61  # same as C#4
        assert pitch_to_midi("Eb4") == 63  # same as D#4
        assert pitch_to_midi("Gb4") == 66  # same as F#4
        assert pitch_to_midi("Ab4") == 68  # same as G#4
        assert pitch_to_midi("Bb4") == 70  # same as A#4

    @pytest.mark.parametrize("midi", [0, 12, 60, 72, 127])
    def test_roundtrip_midi(self, midi: int) -> None:
        """MIDI → pitch → MIDI is always identity."""
        assert pitch_to_midi(midi_to_pitch(midi)) == midi


# ═══════════════════════════════════════════════════════════════════════════════
# transpose_notes
# ═══════════════════════════════════════════════════════════════════════════════


class TestTransposeNotes:
    def test_up_single_semitone(self, simple_notes: list[dict]) -> None:
        result = transpose_notes(simple_notes, 2)
        assert result[0]["pitch"] == "D4"
        assert result[1]["pitch"] == "F#4"
        assert result[2]["pitch"] == "A4"

    def test_down_single_semitone(self, simple_notes: list[dict]) -> None:
        result = transpose_notes(simple_notes, -2)
        assert result[0]["pitch"] == "A#3"
        assert result[1]["pitch"] == "D4"
        assert result[2]["pitch"] == "F4"

    def test_octave_up(self, simple_notes: list[dict]) -> None:
        result = transpose_notes(simple_notes, 12)
        assert result[0]["pitch"] == "C5"

    def test_empty_notes(self) -> None:
        assert transpose_notes([], 3) == []

    def test_immutable_input(self, simple_notes: list[dict]) -> None:
        original = copy.deepcopy(simple_notes)
        transpose_notes(simple_notes, 3)
        assert simple_notes == original

    def test_non_integer_semitones_raises(self, simple_notes: list[dict]) -> None:
        with pytest.raises(TypeError, match="semitones must be an integer"):
            transpose_notes(simple_notes, 2.5)  # type: ignore[arg-type]


# ═══════════════════════════════════════════════════════════════════════════════
# quantize_notes
# ═══════════════════════════════════════════════════════════════════════════════


class TestQuantizeNotes:
    def test_quarter_note_grid(self) -> None:
        notes = [
            {"pitch": "C4", "startBeat": 0.1, "durationBeats": 0.9},
            {"pitch": "D4", "startBeat": 1.3, "durationBeats": 0.5},
        ]
        result = quantize_notes(notes, grid_16ths=4)  # grid_step = 1.0
        assert result[0]["startBeat"] == 0.0
        assert result[1]["startBeat"] == 1.0

    def test_eighth_note_grid(self) -> None:
        notes = [
            {"pitch": "C4", "startBeat": 0.35, "durationBeats": 0.4},
            {"pitch": "D4", "startBeat": 0.65, "durationBeats": 0.4},
        ]
        result = quantize_notes(notes, grid_16ths=2)  # grid_step = 0.5
        assert result[0]["startBeat"] == 0.5
        assert result[1]["startBeat"] == 0.5

    def test_sixteenth_note_grid(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.15, "durationBeats": 0.2}]
        result = quantize_notes(notes, grid_16ths=1)  # grid_step = 0.25
        assert result[0]["startBeat"] == 0.25

    def test_already_on_grid_unchanged(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0}]
        result = quantize_notes(notes, grid_16ths=4)
        assert result[0]["startBeat"] == 0.0
        assert result[0]["durationBeats"] == 1.0

    def test_ensures_minimum_duration(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.0, "durationBeats": 0.01}]
        result = quantize_notes(notes, grid_16ths=4)  # grid_step = 1.0
        assert result[0]["durationBeats"] >= 1.0

    def test_empty_notes(self) -> None:
        assert quantize_notes([], grid_16ths=2) == []

    def test_immutable_input(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.33, "durationBeats": 1.0}]
        original = copy.deepcopy(notes)
        quantize_notes(notes, grid_16ths=4)
        assert notes == original

    def test_invalid_grid_raises(self) -> None:
        with pytest.raises(ValueError):
            quantize_notes([{"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0}], grid_16ths=0)
        with pytest.raises(ValueError):
            quantize_notes([{"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0}], grid_16ths=-1)


# ═══════════════════════════════════════════════════════════════════════════════
# scale_velocity
# ═══════════════════════════════════════════════════════════════════════════════


class TestScaleVelocity:
    def test_half_velocity(self, simple_notes: list[dict]) -> None:
        result = scale_velocity(simple_notes, 0.5)
        assert result[0]["velocity"] == pytest.approx(0.4)
        assert result[1]["velocity"] == pytest.approx(0.3)
        assert result[2]["velocity"] == pytest.approx(0.45)

    def test_clamp_to_one(self, simple_notes: list[dict]) -> None:
        result = scale_velocity(simple_notes, 2.0)
        assert result[2]["velocity"] == pytest.approx(1.0)  # 0.9 * 2 → 1.0

    def test_clamp_to_zero(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": -0.5}]
        result = scale_velocity(notes, 1.0)
        assert result[0]["velocity"] == 0.0

    def test_factor_zero(self, simple_notes: list[dict]) -> None:
        result = scale_velocity(simple_notes, 0.0)
        for r in result:
            assert r["velocity"] == 0.0

    def test_default_velocity_when_missing(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0}]
        result = scale_velocity(notes, 0.5)
        assert result[0]["velocity"] == 0.0

    def test_empty_notes(self) -> None:
        assert scale_velocity([], 0.5) == []

    def test_immutable_input(self, simple_notes: list[dict]) -> None:
        original = copy.deepcopy(simple_notes)
        scale_velocity(simple_notes, 0.5)
        assert simple_notes == original

    def test_negative_factor_raises(self, simple_notes: list[dict]) -> None:
        with pytest.raises(ValueError):
            scale_velocity(simple_notes, -0.1)

    def test_non_finite_factor_raises(self, simple_notes: list[dict]) -> None:
        with pytest.raises(ValueError):
            scale_velocity(simple_notes, math.inf)
        with pytest.raises(ValueError):
            scale_velocity(simple_notes, math.nan)


# ═══════════════════════════════════════════════════════════════════════════════
# shift_notes
# ═══════════════════════════════════════════════════════════════════════════════


class TestShiftNotes:
    def test_forward(self, simple_notes: list[dict]) -> None:
        result = shift_notes(simple_notes, 2.0)
        assert result[0]["startBeat"] == 2.0
        assert result[1]["startBeat"] == 3.0
        assert result[2]["startBeat"] == 4.0

    def test_backward_clamped(self, simple_notes: list[dict]) -> None:
        result = shift_notes(simple_notes, -10.0)
        for r in result:
            assert r["startBeat"] == 0.0

    def test_fractional_offset(self, simple_notes: list[dict]) -> None:
        result = shift_notes(simple_notes, 0.5)
        assert result[0]["startBeat"] == 0.5

    def test_crosses_zero(self) -> None:
        notes = [{"pitch": "C4", "startBeat": 0.5, "durationBeats": 1.0}]
        result = shift_notes(notes, -1.0)
        assert result[0]["startBeat"] == 0.0

    def test_empty_notes(self) -> None:
        assert shift_notes([], 1.0) == []

    def test_immutable_input(self, simple_notes: list[dict]) -> None:
        original = copy.deepcopy(simple_notes)
        shift_notes(simple_notes, 2.0)
        assert simple_notes == original

    def test_non_finite_offset_raises(self, simple_notes: list[dict]) -> None:
        with pytest.raises(ValueError):
            shift_notes(simple_notes, math.inf)


# ═══════════════════════════════════════════════════════════════════════════════
# repeat_motif
# ═══════════════════════════════════════════════════════════════════════════════


class TestRepeatMotif:
    def test_basic_repeat(self, simple_motif: dict) -> None:
        result = repeat_motif(simple_motif, 2)
        assert len(result["notes"]) == 6  # 3 notes × 2
        # First copy starts at 0
        assert result["notes"][0]["startBeat"] == 0.0
        # Second copy starts after pattern duration (max of 0+1, 1+0.5, 2+1 = 3.0)
        assert result["notes"][3]["startBeat"] == 3.0
        assert result["notes"][3]["pitch"] == "C4"

    def test_three_times(self, simple_motif: dict) -> None:
        result = repeat_motif(simple_motif, 3)
        assert len(result["notes"]) == 9

    def test_zero_times(self, simple_motif: dict) -> None:
        result = repeat_motif(simple_motif, 0)
        assert result["notes"] == []

    def test_empty_motif_notes(self) -> None:
        motif = {"id": "empty", "notes": []}
        result = repeat_motif(motif, 5)
        assert result["notes"] == []

    def test_preserves_motif_fields(self, simple_motif: dict) -> None:
        result = repeat_motif(simple_motif, 2)
        assert result["id"] == "motif-1"

    def test_immutable_input(self, simple_motif: dict) -> None:
        original = copy.deepcopy(simple_motif)
        repeat_motif(simple_motif, 2)
        assert simple_motif == original

    def test_negative_times_raises(self, simple_motif: dict) -> None:
        with pytest.raises(ValueError):
            repeat_motif(simple_motif, -1)

    def test_float_times_raises(self, simple_motif: dict) -> None:
        with pytest.raises(ValueError):
            repeat_motif(simple_motif, 2.5)  # type: ignore[arg-type]

    def test_zero_duration_notes(self) -> None:
        """Motif where all notes have zero total duration."""
        motif = {
            "notes": [
                {"pitch": "C4", "startBeat": 0.0, "durationBeats": 0.0},
            ]
        }
        result = repeat_motif(motif, 3)
        assert result["notes"] == []


# ═══════════════════════════════════════════════════════════════════════════════
# invert_motif
# ═══════════════════════════════════════════════════════════════════════════════


class TestInvertMotif:
    def test_basic_invert_c4(self, simple_motif: dict) -> None:
        result = invert_motif(simple_motif, "C4")  # center = 60
        # C4(60) → 60+(60-60) = 60 → C4
        # D4(62) → 60+(60-62) = 58 → A#3
        # E4(64) → 60+(60-64) = 56 → G#3
        assert result["notes"][0]["pitch"] == "C4"
        assert result["notes"][1]["pitch"] == "A#3"
        assert result["notes"][2]["pitch"] == "G#3"

    def test_invert_e4(self, simple_motif: dict) -> None:
        result = invert_motif(simple_motif, "E4")  # center = 64
        assert result["notes"][0]["pitch"] == "G#4"  # 64+(64-60)=68
        assert result["notes"][1]["pitch"] == "F#4"  # 64+(64-62)=66
        assert result["notes"][2]["pitch"] == "E4"   # 64+(64-64)=64

    def test_double_invert_restores_original(self, simple_motif: dict) -> None:
        first = invert_motif(simple_motif, "C4")
        second = invert_motif(first, "C4")
        for orig, restored in zip(simple_motif["notes"], second["notes"]):
            assert restored["pitch"] == orig["pitch"]

    def test_empty_notes(self) -> None:
        motif = {"id": "e", "notes": []}
        result = invert_motif(motif, "C4")
        assert result["notes"] == []

    def test_immutable_input(self, simple_motif: dict) -> None:
        original = copy.deepcopy(simple_motif)
        invert_motif(simple_motif, "C4")
        assert simple_motif == original

    def test_invalid_center_pitch_raises(self, simple_motif: dict) -> None:
        with pytest.raises(ValueError):
            invert_motif(simple_motif, "X5")


# ═══════════════════════════════════════════════════════════════════════════════
# stretch_motif_rhythm
# ═══════════════════════════════════════════════════════════════════════════════


class TestStretchMotifRhythm:
    def test_double(self, simple_motif: dict) -> None:
        result = stretch_motif_rhythm(simple_motif, 2.0)
        assert result["notes"][0]["startBeat"] == 0.0
        assert result["notes"][0]["durationBeats"] == 2.0
        assert result["notes"][1]["startBeat"] == 2.0
        assert result["notes"][1]["durationBeats"] == 1.0

    def test_half(self, simple_motif: dict) -> None:
        result = stretch_motif_rhythm(simple_motif, 0.5)
        assert result["notes"][0]["startBeat"] == 0.0
        assert result["notes"][0]["durationBeats"] == 0.5
        assert result["notes"][1]["startBeat"] == 0.5

    def test_identity(self, simple_motif: dict) -> None:
        result = stretch_motif_rhythm(simple_motif, 1.0)
        for orig, stretched in zip(simple_motif["notes"], result["notes"]):
            assert stretched["startBeat"] == orig["startBeat"]
            assert stretched["durationBeats"] == orig["durationBeats"]

    def test_empty_notes(self) -> None:
        motif = {"id": "e", "notes": []}
        result = stretch_motif_rhythm(motif, 2.0)
        assert result["notes"] == []

    def test_immutable_input(self, simple_motif: dict) -> None:
        original = copy.deepcopy(simple_motif)
        stretch_motif_rhythm(simple_motif, 2.0)
        assert simple_motif == original

    def test_zero_factor_raises(self, simple_motif: dict) -> None:
        with pytest.raises(ValueError):
            stretch_motif_rhythm(simple_motif, 0.0)

    def test_negative_factor_raises(self, simple_motif: dict) -> None:
        with pytest.raises(ValueError):
            stretch_motif_rhythm(simple_motif, -1.0)

    def test_non_finite_factor_raises(self, simple_motif: dict) -> None:
        with pytest.raises(ValueError):
            stretch_motif_rhythm(simple_motif, math.nan)


# ═══════════════════════════════════════════════════════════════════════════════
# generate_motif_variation
# ═══════════════════════════════════════════════════════════════════════════════


class TestGenerateMotifVariation:
    def test_deterministic_same_seed(self, simple_motif: dict) -> None:
        a = generate_motif_variation(simple_motif, seed=42)
        b = generate_motif_variation(simple_motif, seed=42)
        assert a == b

    def test_different_seeds_different(self, simple_motif: dict) -> None:
        a = generate_motif_variation(simple_motif, seed=1)
        b = generate_motif_variation(simple_motif, seed=9999)
        assert a != b

    def test_same_note_count(self, simple_motif: dict) -> None:
        result = generate_motif_variation(simple_motif, seed=7)
        assert len(result["notes"]) == len(simple_motif["notes"])

    def test_empty_notes(self) -> None:
        motif = {"id": "e", "notes": []}
        result = generate_motif_variation(motif, seed=0)
        assert result["notes"] == []

    def test_immutable_input(self, simple_motif: dict) -> None:
        original = copy.deepcopy(simple_motif)
        generate_motif_variation(simple_motif, seed=42)
        assert simple_motif == original

    def test_preserves_motif_fields(self, simple_motif: dict) -> None:
        result = generate_motif_variation(simple_motif, seed=0)
        assert result["id"] == "motif-1"

    def test_variation_stays_musically_reasonable(self, simple_motif: dict) -> None:
        """Pitches should only change by octaves (12 semitones)."""
        result = generate_motif_variation(simple_motif, seed=123)
        for orig_n, var_n in zip(simple_motif["notes"], result["notes"]):
            orig_midi = pitch_to_midi(orig_n["pitch"])
            var_midi = pitch_to_midi(var_n["pitch"])
            diff = abs(var_midi - orig_midi)
            assert diff in (0, 12), f"Unexpected pitch diff {diff}"


# ═══════════════════════════════════════════════════════════════════════════════
# Scales
# ═══════════════════════════════════════════════════════════════════════════════


class TestScales:
    def test_all_scales_contain_tonic(self) -> None:
        for name, intervals in SCALES.items():
            assert 0 in intervals, f"Scale '{name}' missing tonic (interval 0)"

    def test_major_intervals(self) -> None:
        assert SCALES["major"] == [0, 2, 4, 5, 7, 9, 11]

    def test_minor_intervals(self) -> None:
        assert SCALES["minor"] == [0, 2, 3, 5, 7, 8, 10]

    def test_pentatonic_major_has_five_notes(self) -> None:
        assert len(SCALES["pentatonic_major"]) == 5

    def test_blues_has_six_notes(self) -> None:
        assert len(SCALES["blues"]) == 6

    def test_chromatic_is_complete(self) -> None:
        assert SCALES["chromatic"] == list(range(12))


# ═══════════════════════════════════════════════════════════════════════════════
# PITCH_TO_MIDI / MIDI_TO_PITCH tables
# ═══════════════════════════════════════════════════════════════════════════════


class TestPitchTables:
    def test_pitch_to_midi_contains_all_naturals(self) -> None:
        for letter in "CDEFGAB":
            assert letter in PITCH_TO_MIDI

    def test_pitch_to_midi_contains_sharps_and_flats(self) -> None:
        for key in ["C#", "Db", "D#", "Eb", "F#", "Gb", "G#", "Ab", "A#", "Bb"]:
            assert key in PITCH_TO_MIDI

    def test_midi_maps_all_12_classes(self) -> None:
        for pc in range(12):
            assert pc in MIDI_TO_PITCH, f"Pitch class {pc} missing from MIDI_TO_PITCH"

    def test_enharmonic_equivalents(self) -> None:
        assert PITCH_TO_MIDI["C#"] == PITCH_TO_MIDI["Db"]
        assert PITCH_TO_MIDI["D#"] == PITCH_TO_MIDI["Eb"]
        assert PITCH_TO_MIDI["F#"] == PITCH_TO_MIDI["Gb"]
        assert PITCH_TO_MIDI["G#"] == PITCH_TO_MIDI["Ab"]
        assert PITCH_TO_MIDI["A#"] == PITCH_TO_MIDI["Bb"]


# ═══════════════════════════════════════════════════════════════════════════════
# is_note_in_scale
# ═══════════════════════════════════════════════════════════════════════════════


class TestIsNoteInScale:
    def test_c_in_c_major(self) -> None:
        assert is_note_in_scale("C4", "major") is True

    def test_c_sharp_not_in_c_major(self) -> None:
        assert is_note_in_scale("C#4", "major") is False

    def test_c_in_a_minor(self) -> None:
        assert is_note_in_scale("C4", "minor") is True

    def test_all_chromatic_in_chromatic(self) -> None:
        for pc in range(12):
            pitch = midi_to_pitch(pc + 60)
            assert is_note_in_scale(pitch, "chromatic") is True

    def test_unknown_scale_raises(self) -> None:
        with pytest.raises(ValueError, match="Unknown scale"):
            is_note_in_scale("C4", "nonexistent")


# ═══════════════════════════════════════════════════════════════════════════════
# closest_scale_tone
# ═══════════════════════════════════════════════════════════════════════════════


class TestClosestScaleTone:
    def test_already_in_scale_unchanged(self) -> None:
        assert closest_scale_tone("C4", "major") == "C4"
        assert closest_scale_tone("E4", "major") == "E4"
        assert closest_scale_tone("G4", "major") == "G4"

    def test_outside_scale_finds_nearest(self) -> None:
        # C#4 (61) — nearest in C major are C4 (60) or D4 (62)
        # Distance to C: 1, to D: 1 — prefers higher → D4
        assert closest_scale_tone("C#4", "major") == "D4"

    def test_prefers_above_on_tie(self) -> None:
        # D#4 (63) — equally distant from D4 (62) and E4 (64)
        assert closest_scale_tone("D#4", "major") == "E4"

    def test_in_minor_scale(self) -> None:
        # C#4 (61) in minor [0,2,3,5,7,8,10] — classes: 0,2,3,5,7,8,10
        # 61 % 12 = 1 → not in scale. Nearest: 0 (C4, 60) or 2 (D4, 62)
        assert closest_scale_tone("C#4", "minor") == "D4"

    def test_in_blues_scale(self) -> None:
        # F4 (65) in blues [0,3,5,6,7,10] → class 5 is in scale
        assert closest_scale_tone("F4", "blues") == "F4"

    def test_low_boundary(self) -> None:
        # Search should not go below MIDI 0
        result = closest_scale_tone("C0", "major")
        assert result == "C0"

    def test_high_boundary(self) -> None:
        # Should work at high end too
        result = closest_scale_tone("G9", "major")
        assert result == "G9"

    def test_unknown_scale_raises(self) -> None:
        with pytest.raises(ValueError, match="Unknown scale"):
            closest_scale_tone("C4", "nonexistent")


# ═══════════════════════════════════════════════════════════════════════════════
# Extra edge cases
# ═══════════════════════════════════════════════════════════════════════════════


class TestEdgeCases:
    def test_shift_notes_preserves_other_fields(self, simple_notes: list[dict]) -> None:
        result = shift_notes(simple_notes, 1.0)
        assert result[0]["pitch"] == "C4"
        assert result[0]["durationBeats"] == 1.0
        assert result[0]["velocity"] == 0.8

    def test_transpose_preserves_other_fields(self, simple_notes: list[dict]) -> None:
        result = transpose_notes(simple_notes, 2)
        assert result[0]["startBeat"] == 0.0
        assert result[0]["durationBeats"] == 1.0
        assert result[0]["velocity"] == 0.8

    def test_scale_velocity_preserves_other_fields(self, simple_notes: list[dict]) -> None:
        result = scale_velocity(simple_notes, 0.5)
        assert result[0]["pitch"] == "C4"
        assert result[0]["startBeat"] == 0.0
        assert result[0]["durationBeats"] == 1.0

    def test_invert_motif_preserves_non_note_fields(self, simple_motif: dict) -> None:
        result = invert_motif(simple_motif, "C4")
        assert result["id"] == "motif-1"

    def test_motif_preserves_extra_keys(self) -> None:
        motif = {
            "id": "rich-motif",
            "label": "My Pattern",
            "color": "#ff0000",
            "notes": [{"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.8}],
        }
        result = repeat_motif(motif, 2)
        assert result["label"] == "My Pattern"
        assert result["color"] == "#ff0000"
