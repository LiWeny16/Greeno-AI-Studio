"""Tests for the agent tool registry and all 10 music-domain tools."""

from __future__ import annotations

from copy import deepcopy

import pytest

from cc_music.agent.tools import (
    TOOL_REGISTRY,
    dispatch_tool,
    parse_chord_symbol,
    pitch_to_midi,
    midi_to_pitch,
)
from tests.fixtures import SAMPLE_MUSIC_IR_DICT, VALID_PATCH_DICT


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _snapshot() -> dict:
    """Return a deep copy so tests never mutate the shared fixture."""
    return deepcopy(SAMPLE_MUSIC_IR_DICT)


def _ctx(snapshot: dict | None = None) -> dict:
    return {"snapshot": snapshot or _snapshot()}


def _cadence_progression_snapshot() -> dict:
    """Chords Am-Dm-E-Am with clear i-iv-V-i cadence in A minor."""
    snap = _snapshot()
    snap["sections"] = [
        {
            "id": "sec_b",
            "name": "B",
            "barRange": [1, 4],
            "style": {
                "genre": "classical",
                "energy": 0.5,
                "instruments": ["piano"],
            },
            "motifIds": ["motif_main"],
            "chords": ["Am", "Dm", "E", "Am"],
            "locks": {
                "melody": False,
                "rhythm": False,
                "chords": False,
                "tempo": False,
                "key": False,
            },
        }
    ]
    return snap


# ===================================================================
# Registry & dispatch
# ===================================================================


EXPECTED_TOOL_NAMES = frozenset({
    "read_ir_section",
    "analyze_motif",
    "analyze_chord_progression",
    "generate_motif_variation",
    "generate_counter_melody",
    "generate_bassline",
    "generate_drum_pattern",
    "validate_patch_schema",
    "check_lock_violations",
    "build_patch_json",
})


class TestToolRegistry:
    """Tool registration correctness."""

    def test_all_10_tools_registered(self):
        """Every tool from the spec must be registered."""
        registered = set(TOOL_REGISTRY.keys())
        assert registered == EXPECTED_TOOL_NAMES, (
            f"Missing: {EXPECTED_TOOL_NAMES - registered}; "
            f"Extra: {registered - EXPECTED_TOOL_NAMES}"
        )

    def test_each_tool_has_name_description_parameters_handler(self):
        for name, tool in TOOL_REGISTRY.items():
            assert tool.name == name
            assert isinstance(tool.description, str) and len(tool.description) > 0
            assert isinstance(tool.parameters, dict)
            assert callable(tool.handler)


class TestDispatch:
    """dispatch_tool behaviour."""

    async def test_dispatches_valid_tool(self):
        result = await dispatch_tool(
            "analyze_motif",
            {"motif_id": "motif_main"},
            _ctx(),
        )
        assert result["success"] is True
        assert "data" in result
        assert result["data"]["note_count"] == 4

    async def test_unknown_tool_returns_error(self):
        result = await dispatch_tool("nonexistent", {}, _ctx())
        assert result["success"] is False
        assert "Unknown tool" in result["error"]

    async def test_dispatch_with_empty_args_ctx(self):
        result = await dispatch_tool("read_ir_section", {}, {"snapshot": SAMPLE_MUSIC_IR_DICT})
        assert result["success"] is True


# ===================================================================
# read_ir_section
# ===================================================================


class TestReadIrSection:
    async def test_returns_data_for_all_sections_when_no_filter(self):
        result = await dispatch_tool("read_ir_section", {}, _ctx())
        assert result["success"] is True
        data = result["data"]
        assert "notes" in data
        assert "motifs" in data
        assert "chords" in data
        assert "style" in data
        assert "locks" in data

    async def test_filters_by_section_id(self):
        result = await dispatch_tool(
            "read_ir_section", {"section_id": "sec_a"}, _ctx(),
        )
        assert result["success"] is True
        styles = result["data"]["style"]
        assert len(styles) == 1
        assert styles[0]["section_id"] == "sec_a"

    async def test_filters_by_bar_range(self):
        result = await dispatch_tool(
            "read_ir_section", {"bar_range": [1, 4]}, _ctx(),
        )
        assert result["success"] is True
        # The sample section barRange is [1, 8] which overlaps [1, 4]
        assert len(result["data"]["style"]) >= 1

    async def test_empty_snapshot_returns_error(self):
        result = await dispatch_tool("read_ir_section", {}, {"snapshot": {}})
        assert result["success"] is False
        assert "error" in result


# ===================================================================
# analyze_motif
# ===================================================================


class TestAnalyzeMotif:
    async def test_analyzes_sample_motif_correctly(self):
        result = await dispatch_tool(
            "analyze_motif", {"motif_id": "motif_main"}, _ctx(),
        )
        assert result["success"] is True
        data = result["data"]
        assert data["note_count"] == 4
        assert len(data["rhythm_pattern"]) == 4
        assert len(data["intervals"]) == 3  # n-1 intervals
        assert data["register"][0] <= data["register"][1]

        # A4=69, C5=72, E5=76, D5=74 => contour: [0, 3, 7, 5]
        assert data["pitch_contour"] == [0, 3, 7, 5]
        assert data["intervals"] == [3, 4, -2]

    async def test_motif_not_found_returns_error(self):
        result = await dispatch_tool(
            "analyze_motif", {"motif_id": "no_such_motif"}, _ctx(),
        )
        assert result["success"] is False
        assert "not found" in result["error"]

    async def test_missing_motif_id_returns_error(self):
        result = await dispatch_tool("analyze_motif", {}, _ctx())
        assert result["success"] is False

    async def test_empty_motif_returns_zeroed_analysis(self):
        snap = _snapshot()
        snap["motifs"] = [
            {
                "id": "motif_empty",
                "notes": [],
                "source": {"type": "manual"},
            }
        ]
        result = await dispatch_tool(
            "analyze_motif", {"motif_id": "motif_empty"}, _ctx(snap),
        )
        assert result["success"] is True
        assert result["data"]["note_count"] == 0
        assert result["data"]["intervals"] == []


# ===================================================================
# analyze_chord_progression
# ===================================================================


class TestAnalyzeChordProgression:
    async def test_parses_chords_from_section(self):
        result = await dispatch_tool(
            "analyze_chord_progression", {"section_id": "sec_a"}, _ctx(),
        )
        assert result["success"] is True
        chords = result["data"]["chords"]
        assert len(chords) == 4  # Am, F, C, G
        assert chords[0]["root"] == "A"
        assert chords[0]["quality"] == "minor"
        assert chords[1]["root"] == "F"
        assert chords[1]["quality"] == "major"
        assert result["data"]["key"] == "A minor"

    async def test_detects_cadences_with_authentic_progression(self):
        """Am-Dm-E-Am contains authentic cadence (E->Am = V-i)."""
        snap = _cadence_progression_snapshot()
        result = await dispatch_tool(
            "analyze_chord_progression",
            {"section_id": "sec_b"},
            _ctx(snap),
        )
        assert result["success"] is True
        cadences = result["data"]["cadences"]
        cadence_types = {c["type"] for c in cadences}
        assert "authentic" in cadence_types

    async def test_section_not_found_returns_error(self):
        result = await dispatch_tool(
            "analyze_chord_progression",
            {"section_id": "no_such_section"},
            _ctx(),
        )
        assert result["success"] is False

    async def test_missing_section_id_returns_error(self):
        result = await dispatch_tool("analyze_chord_progression", {}, _ctx())
        assert result["success"] is False


# ===================================================================
# generate_motif_variation
# ===================================================================


class TestGenerateMotifVariation:
    async def test_transpose_shifts_all_pitches_up_a_fifth(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "motif_main", "variation_type": "transpose"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["motif"]["notes"]
        assert len(notes) == 4
        # A4->E5, C5->G5, E5->B5, D5->A5
        expected = ["E5", "G5", "B5", "A5"]
        assert [n["pitch"] for n in notes] == expected

    async def test_invert_mirrors_around_first_pitch(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "motif_main", "variation_type": "invert"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["motif"]["notes"]
        # A4=69, C5=72, E5=76, D5=74
        # pivot=69: 69, 66, 62, 64 => A4, F#4, D4, E4
        expected = ["A4", "F#4", "D4", "E4"]
        assert [n["pitch"] for n in notes] == expected

    async def test_retrograde_reverses_note_order(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "motif_main", "variation_type": "retrograde"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["motif"]["notes"]
        # Reversed order: D5, E5, C5, A4
        assert len(notes) == 4
        assert notes[0]["pitch"] == "D5"

    async def test_rhythm_augment_doubles_durations(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "motif_main", "variation_type": "rhythm_augment"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["motif"]["notes"]
        # Original durations all 0.5, doubled = 1.0
        for n in notes:
            assert n["durationBeats"] == 1.0

    async def test_rhythm_diminish_halves_durations(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "motif_main", "variation_type": "rhythm_diminish"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["motif"]["notes"]
        for n in notes:
            assert n["durationBeats"] == 0.25

    async def test_unknown_variation_type_returns_error(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "motif_main", "variation_type": "nonsense"},
            _ctx(),
        )
        assert result["success"] is False

    async def test_unknown_motif_returns_error(self):
        result = await dispatch_tool(
            "generate_motif_variation",
            {"motif_id": "ghost", "variation_type": "transpose"},
            _ctx(),
        )
        assert result["success"] is False


# ===================================================================
# generate_counter_melody
# ===================================================================


class TestGenerateCounterMelody:
    async def test_first_species_produces_note_against_note(self):
        result = await dispatch_tool(
            "generate_counter_melody",
            {"motif_id": "motif_main", "species": "first"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["counter_motif"]["notes"]
        # First species: 1 note per original note
        assert len(notes) == 4

    async def test_second_species_produces_two_against_one(self):
        result = await dispatch_tool(
            "generate_counter_melody",
            {"motif_id": "motif_main", "species": "second"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["counter_motif"]["notes"]
        # Second species: 2 notes per original (8 total)
        assert len(notes) == 8

    async def test_fifth_species_produces_florid_rhythms(self):
        result = await dispatch_tool(
            "generate_counter_melody",
            {"motif_id": "motif_main", "species": "fifth"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["counter_motif"]["notes"]
        # Fifth species: 3 notes per original (12 total)
        assert len(notes) == 12

    async def test_unknown_species_returns_error(self):
        result = await dispatch_tool(
            "generate_counter_melody",
            {"motif_id": "motif_main", "species": "fourth"},
            _ctx(),
        )
        assert result["success"] is False

    async def test_unknown_motif_returns_error(self):
        result = await dispatch_tool(
            "generate_counter_melody",
            {"motif_id": "bad_motif", "species": "first"},
            _ctx(),
        )
        assert result["success"] is False


# ===================================================================
# generate_bassline
# ===================================================================


class TestGenerateBassline:
    async def test_root_fifth_alternates_root_and_fifth(self):
        chords = ["Am", "F", "C", "G"]
        result = await dispatch_tool(
            "generate_bassline",
            {"chord_progression": chords, "style": "root_fifth"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["bassline"]["notes"]
        # 4 chords x 2 notes each = 8
        assert len(notes) == 8

    async def test_walking_bass_produces_quarter_notes(self):
        chords = ["Am", "F"]
        result = await dispatch_tool(
            "generate_bassline",
            {"chord_progression": chords, "style": "walking"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["bassline"]["notes"]
        # 2 chords x 4 steps = 8
        assert len(notes) == 8
        for n in notes:
            assert n["durationBeats"] == 1.0

    async def test_arpeggiated_produces_broken_chords(self):
        chords = ["C"]
        result = await dispatch_tool(
            "generate_bassline",
            {"chord_progression": chords, "style": "arpeggiated"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["bassline"]["notes"]
        assert len(notes) == 4  # root, 3rd, 5th, octave

    async def test_pedal_sustains_root(self):
        chords = ["Am", "Dm"]
        result = await dispatch_tool(
            "generate_bassline",
            {"chord_progression": chords, "style": "pedal"},
            _ctx(),
        )
        assert result["success"] is True
        notes = result["data"]["bassline"]["notes"]
        assert len(notes) == 2
        for n in notes:
            assert n["durationBeats"] == 4.0

    async def test_empty_progression_returns_error(self):
        result = await dispatch_tool(
            "generate_bassline", {"chord_progression": []}, _ctx(),
        )
        assert result["success"] is False

    async def test_unknown_style_returns_error(self):
        result = await dispatch_tool(
            "generate_bassline",
            {"chord_progression": ["C"], "style": "disco"},
            _ctx(),
        )
        assert result["success"] is False


# ===================================================================
# generate_drum_pattern
# ===================================================================


class TestGenerateDrumPattern:
    async def test_rock_pattern_has_kick_snare_hihat(self):
        result = await dispatch_tool(
            "generate_drum_pattern", {"style": "rock"}, _ctx(),
        )
        assert result["success"] is True
        hits = result["data"]["pattern"]["hits"]
        drum_types = {h["drum_type"] for h in hits}
        assert "kick" in drum_types
        assert "snare" in drum_types
        assert "hihat_closed" in drum_types

    async def test_jazz_swing_pattern_has_ride(self):
        result = await dispatch_tool(
            "generate_drum_pattern", {"style": "jazz_swing"}, _ctx(),
        )
        assert result["success"] is True
        drum_types = {h["drum_type"] for h in result["data"]["pattern"]["hits"]}
        assert "ride" in drum_types

    async def test_electronic_pattern_has_clap(self):
        result = await dispatch_tool(
            "generate_drum_pattern", {"style": "electronic"}, _ctx(),
        )
        assert result["success"] is True
        drum_types = {h["drum_type"] for h in result["data"]["pattern"]["hits"]}
        assert "clap" in drum_types

    async def test_hip_hop_pattern_has_hihat_open(self):
        result = await dispatch_tool(
            "generate_drum_pattern", {"style": "hip_hop"}, _ctx(),
        )
        assert result["success"] is True
        drum_types = {h["drum_type"] for h in result["data"]["pattern"]["hits"]}
        assert "hihat_open" in drum_types

    async def test_latin_pattern_has_toms(self):
        result = await dispatch_tool(
            "generate_drum_pattern", {"style": "latin"}, _ctx(),
        )
        assert result["success"] is True
        drum_types = {h["drum_type"] for h in result["data"]["pattern"]["hits"]}
        assert "tom_high" in drum_types
        assert "tom_low" in drum_types

    async def test_multi_bar_produces_scaled_beats(self):
        result = await dispatch_tool(
            "generate_drum_pattern",
            {"style": "rock", "bars": 2},
            _ctx(),
        )
        assert result["success"] is True
        hits = result["data"]["pattern"]["hits"]
        max_beat = max(h["beat"] for h in hits)
        assert max_beat >= 4.0  # second bar starts at beat 4

    async def test_unknown_style_returns_error(self):
        result = await dispatch_tool(
            "generate_drum_pattern", {"style": "polka"}, _ctx(),
        )
        assert result["success"] is False


# ===================================================================
# validate_patch_schema
# ===================================================================


class TestValidatePatchSchema:
    async def test_valid_patch_passes(self):
        result = await dispatch_tool(
            "validate_patch_schema",
            {"proposal": VALID_PATCH_DICT},
            _ctx(),
        )
        assert result["success"] is True
        assert result["data"]["valid"] is True
        assert result["data"]["errors"] == []

    async def test_missing_patch_field_detected(self):
        proposal = {
            "proposalId": "p1",
            "projectId": "demo",
            "summary": "no patch",
            "musicalDiff": {},
        }
        result = await dispatch_tool(
            "validate_patch_schema", {"proposal": proposal}, _ctx(),
        )
        assert result["data"]["valid"] is False
        assert any("patch" in e for e in result["data"]["errors"])

    async def test_non_list_patch_detected(self):
        proposal = {
            "proposalId": "p1",
            "projectId": "demo",
            "summary": "bad patch",
            "patch": "not-a-list",
            "musicalDiff": {},
        }
        result = await dispatch_tool(
            "validate_patch_schema", {"proposal": proposal}, _ctx(),
        )
        assert result["data"]["valid"] is False
        assert any("list" in e.lower() for e in result["data"]["errors"])

    async def test_invalid_op_type_detected(self):
        proposal = {
            "proposalId": "p1",
            "projectId": "demo",
            "summary": "bad op",
            "patch": [{"op": "delete", "path": "/foo"}],
            "musicalDiff": {},
        }
        result = await dispatch_tool(
            "validate_patch_schema", {"proposal": proposal}, _ctx(),
        )
        assert result["data"]["valid"] is False
        assert any("invalid op" in e.lower() for e in result["data"]["errors"])

    async def test_missing_musical_diff_detected(self):
        proposal = {
            "proposalId": "p1",
            "projectId": "demo",
            "summary": "no diff",
            "patch": [],
        }
        result = await dispatch_tool(
            "validate_patch_schema", {"proposal": proposal}, _ctx(),
        )
        assert result["data"]["valid"] is False
        assert any("musicalDiff" in e for e in result["data"]["errors"])

    async def test_non_dict_proposal_detected(self):
        result = await dispatch_tool(
            "validate_patch_schema",
            {"proposal": "just a string"},
            _ctx(),
        )
        assert result["data"]["valid"] is False
        assert any("dict" in e for e in result["data"]["errors"])

    async def test_path_not_starting_with_slash_detected(self):
        proposal = {
            "proposalId": "p1",
            "projectId": "demo",
            "summary": "bad path",
            "patch": [{"op": "replace", "path": "no-slash"}],
            "musicalDiff": {},
        }
        result = await dispatch_tool(
            "validate_patch_schema", {"proposal": proposal}, _ctx(),
        )
        assert result["data"]["valid"] is False
        assert any("start with '/'" in e for e in result["data"]["errors"])

    async def test_missing_proposal_id_and_project_id_detected(self):
        proposal = {
            "summary": "missing ids",
            "patch": [],
            "musicalDiff": {},
        }
        result = await dispatch_tool(
            "validate_patch_schema", {"proposal": proposal}, _ctx(),
        )
        assert result["data"]["valid"] is False
        errors = result["data"]["errors"]
        assert any("proposalId" in e for e in errors)
        assert any("projectId" in e for e in errors)


# ===================================================================
# check_lock_violations
# ===================================================================


class TestCheckLockViolations:
    async def test_detects_melody_lock_violation(self):
        """sec_a has melody=True. A patch touching melody should flag."""
        proposal = {
            "patch": [
                {"op": "replace", "path": "/sections/sec_a/melody/notes/0/pitch", "value": "B4"},
            ],
        }
        result = await dispatch_tool(
            "check_lock_violations", {"proposal": proposal}, _ctx(),
        )
        assert result["success"] is True
        violations = result["data"]["violations"]
        melody_violations = [v for v in violations if v["lock_type"] == "melody"]
        assert len(melody_violations) > 0

    async def test_detects_tempo_lock_violation(self):
        """sec_a has tempo=True."""
        proposal = {
            "patch": [
                {"op": "replace", "path": "/sections/sec_a/tempo", "value": 140},
            ],
        }
        result = await dispatch_tool(
            "check_lock_violations", {"proposal": proposal}, _ctx(),
        )
        violations = result["data"]["violations"]
        tempo_violations = [v for v in violations if v["lock_type"] == "tempo"]
        assert len(tempo_violations) > 0

    async def test_detects_key_lock_violation(self):
        """sec_a has key=True."""
        proposal = {
            "patch": [
                {"op": "replace", "path": "/sections/sec_a/key", "value": "B minor"},
            ],
        }
        result = await dispatch_tool(
            "check_lock_violations", {"proposal": proposal}, _ctx(),
        )
        violations = result["data"]["violations"]
        key_violations = [v for v in violations if v["lock_type"] == "key"]
        assert len(key_violations) > 0

    async def test_detects_chord_lock_violation(self):
        """Set chords=True and test."""
        snap = _snapshot()
        snap["sections"][0]["locks"]["chords"] = True
        proposal = {
            "patch": [
                {"op": "replace", "path": "/sections/sec_a/chords", "value": ["Dm"]},
            ],
        }
        result = await dispatch_tool(
            "check_lock_violations", {"proposal": proposal}, _ctx(snap),
        )
        violations = result["data"]["violations"]
        chord_violations = [v for v in violations if v["lock_type"] == "chords"]
        assert len(chord_violations) > 0

    async def test_detects_rhythm_lock_violation(self):
        """Set rhythm=True and test with a duration path."""
        snap = _snapshot()
        snap["sections"][0]["locks"]["rhythm"] = True
        proposal = {
            "patch": [
                {"op": "replace", "path": "/sections/sec_a/notes/0/durationBeats", "value": 1.0},
            ],
        }
        result = await dispatch_tool(
            "check_lock_violations", {"proposal": proposal}, _ctx(snap),
        )
        violations = result["data"]["violations"]
        rhythm_violations = [v for v in violations if v["lock_type"] == "rhythm"]
        assert len(rhythm_violations) > 0

    async def test_no_violations_when_lock_is_false(self):
        """Default sec_a has rhythm=False, chords=False.  Paths targeting these should pass."""
        proposal = {
            "patch": [
                {"op": "replace", "path": "/sections/sec_a/rhythm", "value": "swing"},
            ],
        }
        result = await dispatch_tool(
            "check_lock_violations", {"proposal": proposal}, _ctx(),
        )
        # The keyword "rhythm" matches the rhythm lock_type, but sec_a has rhythm=False
        # so no violation should be raised.
        violations = result["data"]["violations"]
        # The path contains "rhythm" but since rhythm lock is False for sec_a,
        # and the melody lock is True but the path doesn't contain melody keywords,
        # no violation should be found. Actually wait:
        # melody lock is True. Keywords for melody include "melody", "notes", "pitch", "motif".
        # The path "/sections/sec_a/rhythm" doesn't match any melody keyword.
        # rhythm lock is False, so even though "rhythm" matches, the lock isn't active.
        # chords lock is False.
        # tempo lock is True but "rhythm" doesn't match tempo keywords ("tempo").
        # key lock is True but "rhythm" doesn't match key keywords ("key").
        # So yes, no violations.
        assert violations == []

    async def test_no_snapshot_returns_error(self):
        result = await dispatch_tool(
            "check_lock_violations",
            {"proposal": {"patch": []}},
            {},
        )
        assert result["success"] is False

    async def test_non_list_patch_returns_empty_violations(self):
        result = await dispatch_tool(
            "check_lock_violations",
            {"proposal": {"patch": "not-a-list"}},
            _ctx(),
        )
        assert result["success"] is True
        assert result["data"]["violations"] == []


# ===================================================================
# build_patch_json
# ===================================================================


class TestBuildPatchJson:
    async def test_builds_valid_proposal_from_operations(self):
        ops = [
            {"op": "replace", "path": "/sections/0/style/genre", "value": "dark ambient"},
            {"op": "add", "path": "/motifs/-", "value": {"id": "m2", "notes": []}},
            {"op": "remove", "path": "/tracks/0/clips/0"},
        ]
        result = await dispatch_tool(
            "build_patch_json",
            {"operations": ops, "description": "Test patch"},
            _ctx(),
        )
        assert result["success"] is True
        proposal = result["data"]["proposal"]
        assert proposal["summary"] == "Test patch"
        assert len(proposal["patch"]) == 3
        assert proposal["musicalDiff"]["notesAdded"] == 1
        assert proposal["musicalDiff"]["notesRemoved"] == 1

        # Verify schema-valid by re-parsing with the IR model.
        from cc_music.music.ir import IrPatchProposal
        IrPatchProposal.model_validate(proposal)  # raises on failure

    async def test_empty_operations_returns_error(self):
        result = await dispatch_tool(
            "build_patch_json", {"operations": []}, _ctx(),
        )
        assert result["success"] is False

    async def test_non_list_operations_returns_error(self):
        result = await dispatch_tool(
            "build_patch_json", {"operations": "nope"}, _ctx(),
        )
        assert result["success"] is False

    async def test_invalid_op_type_returns_error(self):
        ops = [
            {"op": "delete", "path": "/foo"},  # "delete" is not in _VALID_OPS
        ]
        result = await dispatch_tool(
            "build_patch_json", {"operations": ops}, _ctx(),
        )
        assert result["success"] is False

    async def test_missing_path_returns_error(self):
        ops = [
            {"op": "add"},  # missing path
        ]
        result = await dispatch_tool(
            "build_patch_json", {"operations": ops}, _ctx(),
        )
        assert result["success"] is False

    async def test_uses_default_description_when_omitted(self):
        ops = [
            {"op": "replace", "path": "/title", "value": "New Title"},
        ]
        result = await dispatch_tool(
            "build_patch_json", {"operations": ops}, _ctx(),
        )
        assert result["success"] is True
        assert result["data"]["proposal"]["summary"] == "Agent-generated patch"

    async def test_proposal_id_is_unique(self):
        ops = [{"op": "replace", "path": "/title", "value": "T1"}]
        r1 = await dispatch_tool("build_patch_json", {"operations": ops}, _ctx())
        r2 = await dispatch_tool("build_patch_json", {"operations": ops}, _ctx())
        id1 = r1["data"]["proposal"]["proposalId"]
        id2 = r2["data"]["proposal"]["proposalId"]
        assert id1 != id2


# ===================================================================
# Utility functions
# ===================================================================


class TestPitchUtilities:
    def test_pitch_to_midi_roundtrip(self):
        for pitch in ["A4", "C5", "E5", "D5", "G3", "F#4", "Bb3", "Eb5"]:
            assert midi_to_pitch(pitch_to_midi(pitch)) == pitch

    def test_invalid_pitch_raises(self):
        with pytest.raises(ValueError):
            pitch_to_midi("H4")


class TestChordParsing:
    def test_parses_major_chord(self):
        assert parse_chord_symbol("C") == {"root": "C", "quality": "major"}

    def test_parses_minor_chord(self):
        assert parse_chord_symbol("Am") == {"root": "A", "quality": "minor"}

    def test_parses_diminished_chord(self):
        assert parse_chord_symbol("Bdim") == {"root": "B", "quality": "diminished"}

    def test_parses_seventh_chord(self):
        assert parse_chord_symbol("G7") == {"root": "G", "quality": "dominant_seventh"}

    def test_parses_sharp_root(self):
        assert parse_chord_symbol("F#m") == {"root": "F#", "quality": "minor"}
