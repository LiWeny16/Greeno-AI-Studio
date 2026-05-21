"""Tests for Pydantic Music IR schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from cc_music.music.ir import (
    EditCommand,
    IrPatchProposal,
    JsonPatchOp,
    MidiClip,
    Motif,
    MusicIr,
    Note,
    ProjectEvent,
    ProjectManifest,
    Section,
    Track,
    ir_from_json,
    ir_to_json,
    validate_music_ir,
    validate_patch_proposal,
)

from .fixtures import (
    INVALID_JSON_STR,
    INVALID_PATCH_DICT,
    SAMPLE_MANIFEST_DICT,
    SAMPLE_MUSIC_IR_DICT,
    SAMPLE_PROJECT_EVENT_DICT,
    VALID_PATCH_DICT,
)


# ---------------------------------------------------------------------------
# Leaf model tests
# ---------------------------------------------------------------------------


class TestNote:
    """Tests for Note model."""

    def test_parses_valid_note(self) -> None:
        note = Note.model_validate({
            "pitch": "C4",
            "startBeat": 0.0,
            "durationBeats": 1.0,
            "velocity": 0.5,
        })
        assert note.pitch == "C4"
        assert note.durationBeats == 1.0

    def test_rejects_negative_start_beat(self) -> None:
        with pytest.raises(ValidationError):
            Note.model_validate({
                "pitch": "C4",
                "startBeat": -1.0,
                "durationBeats": 1.0,
                "velocity": 0.5,
            })

    def test_rejects_velocity_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            Note.model_validate({
                "pitch": "C4",
                "startBeat": 0.0,
                "durationBeats": 1.0,
                "velocity": 1.5,
            })

    def test_rejects_zero_duration(self) -> None:
        with pytest.raises(ValidationError):
            Note.model_validate({
                "pitch": "C4",
                "startBeat": 0.0,
                "durationBeats": 0.0,
                "velocity": 0.5,
            })

    def test_rejects_empty_pitch(self) -> None:
        with pytest.raises(ValidationError):
            Note.model_validate({
                "pitch": "",
                "startBeat": 0.0,
                "durationBeats": 1.0,
                "velocity": 0.5,
            })


class TestMotif:
    """Tests for Motif model."""

    def test_parses_with_default_lock_strength(self) -> None:
        motif = Motif.model_validate({
            "id": "m1",
            "notes": [
                {"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.5},
            ],
            "source": {"type": "manual"},
        })
        assert motif.id == "m1"
        assert motif.lockStrength == 0.5
        assert motif.source.type == "manual"

    def test_parses_custom_lock_strength(self) -> None:
        motif = Motif.model_validate({
            "id": "m2",
            "notes": [
                {"pitch": "D4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.6},
            ],
            "source": {"type": "agent"},
            "lockStrength": 0.9,
        })
        assert motif.lockStrength == 0.9

    def test_rejects_invalid_source_type(self) -> None:
        with pytest.raises(ValidationError):
            Motif.model_validate({
                "id": "m1",
                "notes": [
                    {"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.5},
                ],
                "source": {"type": "invalid_source"},
            })


class TestBarRange:
    """Tests for BarRange validation."""

    def test_rejects_start_gt_end(self) -> None:
        with pytest.raises(ValidationError):
            Section.model_validate({
                "id": "s1",
                "name": "Verse",
                "barRange": [8, 1],
                "style": {"genre": "rock", "energy": 0.5, "instruments": ["guitar"]},
                "motifIds": ["m1"],
                "chords": ["C"],
                "locks": {
                    "melody": False, "rhythm": False, "chords": False,
                    "tempo": False, "key": False,
                },
            })

    def test_rejects_zero_bar(self) -> None:
        with pytest.raises(ValidationError):
            Section.model_validate({
                "id": "s1",
                "name": "Verse",
                "barRange": [0, 8],
                "style": {"genre": "rock", "energy": 0.5, "instruments": ["guitar"]},
                "motifIds": ["m1"],
                "chords": ["C"],
                "locks": {
                    "melody": False, "rhythm": False, "chords": False,
                    "tempo": False, "key": False,
                },
            })


class TestSection:
    """Tests for Section model."""

    def test_parses_valid_section(self) -> None:
        sec = Section.model_validate({
            "id": "s1",
            "name": "Verse",
            "barRange": [1, 8],
            "style": {"genre": "rock", "energy": 0.7, "instruments": ["guitar", "drums"]},
            "motifIds": ["m1"],
            "chords": ["C", "G", "Am"],
            "locks": {
                "melody": True, "rhythm": False, "chords": False,
                "tempo": True, "key": False,
            },
        })
        assert sec.barRange == (1, 8)
        assert len(sec.style.instruments) == 2

    def test_rejects_empty_id(self) -> None:
        with pytest.raises(ValidationError):
            Section.model_validate({
                "id": "",
                "name": "Verse",
                "barRange": [1, 8],
                "style": {"genre": "rock", "energy": 0.5, "instruments": ["guitar"]},
                "motifIds": ["m1"],
                "chords": ["C"],
                "locks": {
                    "melody": False, "rhythm": False, "chords": False,
                    "tempo": False, "key": False,
                },
            })


class TestMidiClip:
    """Tests for MidiClip model."""

    def test_parses_without_motif_id(self) -> None:
        clip = MidiClip.model_validate({
            "id": "c1",
            "barRange": [1, 4],
            "notes": [
                {"pitch": "E4", "startBeat": 0.0, "durationBeats": 0.5, "velocity": 0.8},
            ],
        })
        assert clip.motifId is None

    def test_parses_with_motif_id(self) -> None:
        clip = MidiClip.model_validate({
            "id": "c1",
            "barRange": [1, 4],
            "motifId": "motif_main",
            "notes": [
                {"pitch": "E4", "startBeat": 0.0, "durationBeats": 0.5, "velocity": 0.8},
            ],
        })
        assert clip.motifId == "motif_main"


class TestTrack:
    """Tests for Track model."""

    def test_parses_valid_track(self) -> None:
        track = Track.model_validate({
            "id": "t1",
            "name": "Lead",
            "type": "midi",
            "instrument": "violin",
            "clips": [
                {
                    "id": "c1",
                    "barRange": [1, 4],
                    "notes": [
                        {"pitch": "E4", "startBeat": 0.0, "durationBeats": 0.5, "velocity": 0.8},
                    ],
                }
            ],
        })
        assert track.type == "midi"
        assert len(track.clips) == 1

    def test_rejects_non_midi_type(self) -> None:
        with pytest.raises(ValidationError):
            Track.model_validate({
                "id": "t1",
                "name": "Audio",
                "type": "audio",
                "instrument": "piano",
                "clips": [],
            })


# ---------------------------------------------------------------------------
# Top-level model tests
# ---------------------------------------------------------------------------


class TestMusicIr:
    """Tests for MusicIr model."""

    def test_parses_sample(self) -> None:
        ir = validate_music_ir(SAMPLE_MUSIC_IR_DICT)
        assert ir.projectId == "demo"
        assert ir.schemaVersion == 1
        assert ir.tempo == 120
        assert ir.key == "A minor"
        assert ir.timeSignature == "4/4"
        assert len(ir.sections) == 1
        assert len(ir.motifs) == 1
        assert len(ir.tracks) == 1

    def test_rejects_tempo_out_of_range(self) -> None:
        data = {**SAMPLE_MUSIC_IR_DICT, "tempo": 999}
        with pytest.raises(ValidationError):
            validate_music_ir(data)

    def test_rejects_invalid_schema_version(self) -> None:
        data = {**SAMPLE_MUSIC_IR_DICT, "schemaVersion": 2}
        with pytest.raises(ValidationError):
            validate_music_ir(data)

    def test_rejects_invalid_time_signature(self) -> None:
        data = {**SAMPLE_MUSIC_IR_DICT, "timeSignature": "abc"}
        with pytest.raises(ValidationError):
            validate_music_ir(data)

    def test_rejects_missing_sections(self) -> None:
        data = {k: v for k, v in SAMPLE_MUSIC_IR_DICT.items() if k != "sections"}
        with pytest.raises(ValidationError):
            validate_music_ir(data)


class TestProjectManifest:
    """Tests for ProjectManifest model."""

    def test_parses_sample(self) -> None:
        m = ProjectManifest.model_validate(SAMPLE_MANIFEST_DICT)
        assert m.projectId == "demo"
        assert m.schemaVersion == 1
        assert m.title == "Demo Sketch"

    def test_optional_fields_default_none(self) -> None:
        m = ProjectManifest.model_validate(SAMPLE_MANIFEST_DICT)
        assert m.owner is None
        assert m.team is None


class TestProjectEvent:
    """Tests for ProjectEvent model."""

    def test_parses_sample(self) -> None:
        event = ProjectEvent.model_validate(SAMPLE_PROJECT_EVENT_DICT)
        assert event.eventId == "evt_000001"
        assert event.type == "project_created"
        assert event.actor.type == "local_user"

    def test_payload_defaults_to_empty_dict(self) -> None:
        event = ProjectEvent.model_validate({
            "eventId": "evt_1",
            "projectId": "demo",
            "actor": {"type": "local_user"},
            "type": "project_saved",
            "timestamp": "2026-05-21T00:00:00.000Z",
        })
        assert event.payload == {}


# ---------------------------------------------------------------------------
# Patch model tests
# ---------------------------------------------------------------------------


class TestJsonPatchOp:
    """Tests for JsonPatchOp model."""

    def test_parses_add_op(self) -> None:
        op = JsonPatchOp.model_validate({
            "op": "add",
            "path": "/tracks/0",
            "value": {"id": "new"},
        })
        assert op.op == "add"
        assert op.value == {"id": "new"}

    def test_rejects_invalid_op(self) -> None:
        with pytest.raises(ValidationError):
            JsonPatchOp.model_validate({"op": "invalid", "path": "/foo"})

    def test_requires_path_starting_with_slash(self) -> None:
        with pytest.raises(ValidationError):
            JsonPatchOp.model_validate({"op": "add", "path": "no-slash"})

    def test_value_defaults_to_none(self) -> None:
        op = JsonPatchOp.model_validate({"op": "remove", "path": "/sections/0"})
        assert op.value is None


class TestIrPatchProposal:
    """Tests for IrPatchProposal model."""

    def test_parses_sample(self) -> None:
        p = validate_patch_proposal(VALID_PATCH_DICT)
        assert p.proposalId == "patch_000001"
        assert p.projectId == "demo"
        assert len(p.patch) == 1
        assert p.musicalDiff.notesAdded == 8
        assert p.musicalDiff.notesRemoved == 2
        assert p.musicalDiff.preservedMotifs == ["motif_main"]

    def test_rejects_invalid_patch(self) -> None:
        with pytest.raises(ValidationError):
            validate_patch_proposal(INVALID_PATCH_DICT)


# ---------------------------------------------------------------------------
# EditCommand tests
# ---------------------------------------------------------------------------


class TestEditCommand:
    """Tests for EditCommand model."""

    def test_parses_valid_command(self) -> None:
        cmd = EditCommand.model_validate({
            "commandId": "cmd_1",
            "projectId": "demo",
            "type": "transpose",
        })
        assert cmd.type == "transpose"
        assert cmd.selection.barRange is None

    def test_selection_defaults_to_empty(self) -> None:
        cmd = EditCommand.model_validate({
            "commandId": "cmd_1",
            "projectId": "demo",
            "type": "edit_notes",
            "payload": {"semitone": 2},
        })
        assert cmd.selection.barRange is None
        assert cmd.selection.sectionIds is None
        assert cmd.payload == {"semitone": 2}

    def test_parses_with_selection(self) -> None:
        cmd = EditCommand.model_validate({
            "commandId": "cmd_1",
            "projectId": "demo",
            "type": "edit_notes",
            "selection": {
                "barRange": [1, 4],
                "sectionIds": ["sec_a"],
            },
        })
        assert cmd.selection.barRange == (1, 4)
        assert cmd.selection.sectionIds == ["sec_a"]


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestHelperFunctions:
    """Tests for ir_to_json / ir_from_json / validation helpers."""

    def test_round_trip_dict_to_json_to_dict(self) -> None:
        ir = validate_music_ir(SAMPLE_MUSIC_IR_DICT)
        json_str = ir_to_json(ir)
        ir2 = ir_from_json(json_str)
        assert ir2.projectId == ir.projectId
        assert ir2.tempo == ir.tempo
        assert ir2.schemaVersion == ir.schemaVersion
        assert len(ir2.sections) == len(ir.sections)
        assert len(ir2.motifs) == len(ir.motifs)
        assert len(ir2.tracks) == len(ir.tracks)

    def test_ir_from_json_rejects_malformed(self) -> None:
        with pytest.raises(Exception):
            ir_from_json(INVALID_JSON_STR)

    def test_validate_music_ir_returns_music_ir(self) -> None:
        ir = validate_music_ir(SAMPLE_MUSIC_IR_DICT)
        assert isinstance(ir, MusicIr)

    def test_validate_patch_proposal_returns_ir_patch_proposal(self) -> None:
        p = validate_patch_proposal(VALID_PATCH_DICT)
        assert isinstance(p, IrPatchProposal)
