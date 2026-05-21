"""Tests for schema validation and lock checking."""

from __future__ import annotations

import pytest

from cc_music.music.validate import (
    check_lock_violations,
    validate_music_ir,
    validate_patch_proposal,
)

# ---------------------------------------------------------------------------
# Shared fixture data
# ---------------------------------------------------------------------------


def _full_ir(**overrides: object) -> dict:
    """Build a full valid Music IR dict, optionally overriding top-level keys."""
    data: dict = {
        "schemaVersion": 1,
        "projectId": "proj-001",
        "title": "Test Song",
        "tempo": 120,
        "key": "C",
        "timeSignature": "4/4",
        "sections": [
            {
                "id": "sec-1",
                "name": "Verse",
                "barRange": [1, 8],
                "style": {
                    "genre": "pop",
                    "energy": 0.7,
                    "instruments": ["piano", "drums"],
                },
                "motifIds": ["motif-1"],
                "chords": ["Cmaj", "Gmaj"],
                "locks": {
                    "melody": False,
                    "rhythm": False,
                    "chords": False,
                    "tempo": False,
                    "key": False,
                },
            }
        ],
        "motifs": [
            {
                "id": "motif-1",
                "notes": [
                    {
                        "pitch": "C4",
                        "startBeat": 0.0,
                        "durationBeats": 1.0,
                        "velocity": 0.8,
                    }
                ],
                "source": {"type": "manual"},
                "lockStrength": 0.5,
            }
        ],
        "tracks": [
            {
                "id": "track-1",
                "name": "Piano",
                "type": "midi",
                "instrument": "piano",
                "clips": [
                    {
                        "id": "clip-1",
                        "barRange": [1, 8],
                        "motifId": "motif-1",
                        "notes": [
                            {
                                "pitch": "C4",
                                "startBeat": 0.0,
                                "durationBeats": 1.0,
                                "velocity": 0.8,
                            }
                        ],
                    }
                ],
            }
        ],
    }
    data.update(overrides)  # type: ignore[arg-type]
    return data


def _full_proposal(**overrides: object) -> dict:
    """Build a full valid IrPatchProposal dict."""
    proposal: dict = {
        "proposalId": "prop-001",
        "projectId": "proj-001",
        "summary": "Add a note to the verse",
        "patch": [
            {"op": "add", "path": "/sections/0/notes/0", "value": {"pitch": "E4"}},
            {"op": "replace", "path": "/tempo", "value": 130},
            {"op": "remove", "path": "/sections/0/notes/1"},
        ],
        "musicalDiff": {
            "barsChanged": [1, 4],
            "notesAdded": 2,
            "notesRemoved": 0,
            "preservedMotifs": ["motif-1"],
        },
    }
    proposal.update(overrides)  # type: ignore[arg-type]
    return proposal


# ---------------------------------------------------------------------------
# validate_music_ir tests
# ---------------------------------------------------------------------------


class TestValidateMusicIr:
    """Tests for validate_music_ir."""

    def test_valid_full_ir_passes(self) -> None:
        """A complete valid Music IR should pass validation."""
        ok, errors = validate_music_ir(_full_ir())
        assert ok, f"Expected valid, got errors: {errors}"
        assert errors == []

    def test_minimal_valid_ir_passes(self) -> None:
        """A minimal valid IR with empty arrays should pass."""
        data = {
            "schemaVersion": 1,
            "projectId": "proj-001",
            "title": "Minimal",
            "tempo": 120,
            "key": "C",
            "timeSignature": "4/4",
            "sections": [],
            "motifs": [],
            "tracks": [],
        }
        ok, errors = validate_music_ir(data)
        assert ok, f"Expected valid, got errors: {errors}"

    def test_non_dict_fails(self) -> None:
        """A non-dict input should fail."""
        ok, errors = validate_music_ir(None)  # type: ignore[arg-type]
        assert not ok
        assert any("must be an object" in e for e in errors)

    def test_missing_schema_version_fails(self) -> None:
        """Missing schemaVersion should fail."""
        data = _full_ir()
        del data["schemaVersion"]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("schemaVersion" in e for e in errors)

    def test_wrong_schema_version_fails(self) -> None:
        """schemaVersion != 1 should fail."""
        ok, errors = validate_music_ir(_full_ir(schemaVersion=2))
        assert not ok
        assert any("schemaVersion" in e for e in errors)

    def test_tempo_0_fails(self) -> None:
        """Tempo below 40 should fail."""
        ok, errors = validate_music_ir(_full_ir(tempo=0))
        assert not ok
        assert any("tempo" in e for e in errors)

    def test_tempo_300_fails(self) -> None:
        """Tempo above 240 should fail."""
        ok, errors = validate_music_ir(_full_ir(tempo=300))
        assert not ok
        assert any("tempo" in e for e in errors)

    def test_tempo_39_fails(self) -> None:
        """Tempo 39 (just below minimum) should fail."""
        ok, errors = validate_music_ir(_full_ir(tempo=39))
        assert not ok
        assert any("tempo" in e for e in errors)

    def test_tempo_241_fails(self) -> None:
        """Tempo 241 (just above maximum) should fail."""
        ok, errors = validate_music_ir(_full_ir(tempo=241))
        assert not ok
        assert any("tempo" in e for e in errors)

    def test_tempo_min_boundary_passes(self) -> None:
        """Tempo 40 is valid."""
        ok, errors = validate_music_ir(_full_ir(tempo=40))
        assert ok

    def test_tempo_max_boundary_passes(self) -> None:
        """Tempo 240 is valid."""
        ok, errors = validate_music_ir(_full_ir(tempo=240))
        assert ok

    def test_invalid_time_signature_fails(self) -> None:
        """Non-matching timeSignature should fail."""
        ok, errors = validate_music_ir(_full_ir(timeSignature="common"))
        assert not ok
        assert any("timeSignature" in e for e in errors)

    def test_valid_time_signatures_pass(self) -> None:
        """Various valid time signatures should pass."""
        for ts in ("4/4", "3/4", "6/8", "12/8", "7/8", "2/2"):
            data = _full_ir(timeSignature=ts)
            ok, errors = validate_music_ir(data)
            assert ok, f"Expected {ts!r} to be valid, got: {errors}"

    def test_missing_project_id_fails(self) -> None:
        """Missing projectId should fail."""
        data = _full_ir()
        del data["projectId"]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("projectId" in e for e in errors)

    def test_missing_title_fails(self) -> None:
        """Missing title should fail."""
        data = _full_ir()
        del data["title"]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("title" in e for e in errors)

    def test_missing_tempo_fails(self) -> None:
        """Missing tempo should fail."""
        data = _full_ir()
        del data["tempo"]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("tempo" in e for e in errors)

    def test_section_missing_id_fails(self) -> None:
        """Section without id should fail."""
        data = _full_ir()
        del data["sections"][0]["id"]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("id" in e for e in errors)

    def test_section_invalid_bar_range_fails(self) -> None:
        """Section with invalid barRange should fail."""
        data = _full_ir()
        data["sections"][0]["barRange"] = [8, 1]  # start > end
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("start must be <= end" in e for e in errors)

    def test_section_invalid_style_energy_fails(self) -> None:
        """Section with style.energy out of range should fail."""
        data = _full_ir()
        data["sections"][0]["style"]["energy"] = 1.5
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("energy" in e for e in errors)

    def test_motif_invalid_source_type_fails(self) -> None:
        """Motif with invalid source.type should fail."""
        data = _full_ir()
        data["motifs"][0]["source"]["type"] = "unknown_source"  # type: ignore[index]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("source" in e for e in errors)

    def test_note_invalid_velocity_fails(self) -> None:
        """Note with velocity out of [0,1] should fail."""
        data = _full_ir()
        data["motifs"][0]["notes"][0]["velocity"] = 1.5
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("velocity" in e for e in errors)

    def test_note_negative_duration_fails(self) -> None:
        """Note with non-positive duration should fail."""
        data = _full_ir()
        data["motifs"][0]["notes"][0]["durationBeats"] = 0
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("durationBeats" in e for e in errors)

    def test_track_wrong_type_fails(self) -> None:
        """Track type must be 'midi'."""
        data = _full_ir()
        data["tracks"][0]["type"] = "audio"  # type: ignore[literal-required]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("type" in e for e in errors)

    def test_track_missing_instrument_fails(self) -> None:
        """Track without instrument should fail."""
        data = _full_ir()
        del data["tracks"][0]["instrument"]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("instrument" in e for e in errors)

    def test_clip_invalid_bar_range_fails(self) -> None:
        """Clip with invalid barRange should fail."""
        data = _full_ir()
        data["tracks"][0]["clips"][0]["barRange"] = [0, 8]  # non-positive
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("positive integer" in e for e in errors)

    def test_sections_not_array_fails(self) -> None:
        """sections not being an array should fail."""
        data = _full_ir()
        data["sections"] = "not-an-array"  # type: ignore[assignment]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("sections" in e for e in errors)

    def test_motifs_not_array_fails(self) -> None:
        """motifs not being an array should fail."""
        data = _full_ir()
        data["motifs"] = "not-an-array"  # type: ignore[assignment]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("motifs" in e for e in errors)

    def test_tracks_not_array_fails(self) -> None:
        """tracks not being an array should fail."""
        data = _full_ir()
        data["tracks"] = "not-an-array"  # type: ignore[assignment]
        ok, errors = validate_music_ir(data)
        assert not ok
        assert any("tracks" in e for e in errors)


# ---------------------------------------------------------------------------
# validate_patch_proposal tests
# ---------------------------------------------------------------------------


class TestValidatePatchProposal:
    """Tests for validate_patch_proposal."""

    def test_valid_proposal_passes(self) -> None:
        """A complete valid proposal should pass."""
        ok, errors = validate_patch_proposal(_full_proposal(), _full_ir())
        assert ok, f"Expected valid, got errors: {errors}"
        assert errors == []

    def test_missing_proposal_id_fails(self) -> None:
        """Missing proposalId should fail."""
        prop = _full_proposal()
        del prop["proposalId"]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("proposalId" in e for e in errors)

    def test_missing_project_id_fails(self) -> None:
        """Missing projectId should fail."""
        prop = _full_proposal()
        del prop["projectId"]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("projectId" in e for e in errors)

    def test_missing_summary_fails(self) -> None:
        """Missing summary should fail."""
        prop = _full_proposal()
        del prop["summary"]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("summary" in e for e in errors)

    def test_invalid_patch_op_delete_fails(self) -> None:
        """JSON patch op 'delete' is not allowed (only add/remove/replace)."""
        prop = _full_proposal()
        prop["patch"] = [{"op": "delete", "path": "/sections/0"}]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("op" in e for e in errors)

    def test_patch_path_without_leading_slash_fails(self) -> None:
        """JSON patch path must start with '/'."""
        prop = _full_proposal()
        prop["patch"] = [{"op": "add", "path": "sections/0"}]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("path" in e for e in errors)

    def test_patch_not_array_fails(self) -> None:
        """patch field must be an array."""
        prop = _full_proposal()
        prop["patch"] = "not-an-array"  # type: ignore[assignment]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("patch" in e for e in errors)

    def test_missing_musical_diff_fails(self) -> None:
        """Missing musicalDiff should fail."""
        prop = _full_proposal()
        del prop["musicalDiff"]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("musicalDiff" in e for e in errors)

    def test_negative_notes_added_fails(self) -> None:
        """musicalDiff.notesAdded cannot be negative."""
        prop = _full_proposal()
        prop["musicalDiff"] = {"notesAdded": -1, "notesRemoved": 0}
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("notesAdded" in e for e in errors)

    def test_negative_notes_removed_fails(self) -> None:
        """musicalDiff.notesRemoved cannot be negative."""
        prop = _full_proposal()
        prop["musicalDiff"] = {"notesAdded": 0, "notesRemoved": -5}
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("notesRemoved" in e for e in errors)

    def test_non_dict_proposal_fails(self) -> None:
        """A non-dict proposal should fail."""
        ok, errors = validate_patch_proposal(None, _full_ir())  # type: ignore[arg-type]
        assert not ok

    def test_patch_op_element_not_dict_reported(self) -> None:
        """A non-dict element in the patch array should produce an error."""
        prop = _full_proposal()
        prop["patch"] = ["not-a-dict"]  # type: ignore[list-item]
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("must be an object" in e for e in errors)

    def test_preserved_motifs_non_string_fails(self) -> None:
        """preservedMotifs element must be a non-empty string."""
        prop = _full_proposal(musicalDiff={"notesAdded": 0, "notesRemoved": 0, "preservedMotifs": [""]})
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert not ok
        assert any("preservedMotifs" in e for e in errors)

    def test_empty_patch_array_passes(self) -> None:
        """An empty patch array is valid."""
        prop = _full_proposal(patch=[], musicalDiff={"notesAdded": 0, "notesRemoved": 0})
        ok, errors = validate_patch_proposal(prop, _full_ir())
        assert ok, f"Expected valid, got: {errors}"


# ---------------------------------------------------------------------------
# check_lock_violations tests
# ---------------------------------------------------------------------------


class TestCheckLockViolations:
    """Tests for check_lock_violations."""

    def test_no_locks_allows_all_changes(self) -> None:
        """When no locks are active, no violations should be reported."""
        ir = _full_ir()
        # All locks are False by default in _full_ir
        proposal = _full_proposal(
            patch=[
                {"op": "replace", "path": "/tempo", "value": 140},
                {"op": "replace", "path": "/key", "value": "D"},
                {"op": "add", "path": "/sections/0/notes/0", "value": {"pitch": "E4"}},
                {"op": "replace", "path": "/sections/0/notes/0/durationBeats", "value": 2.0},
                {"op": "replace", "path": "/sections/0/chords", "value": ["Am"]},
            ]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == [], f"Expected no violations, got: {violations}"

    def test_melody_lock_catches_note_changes(self) -> None:
        """Melody lock should reject patches to notes in that section."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["melody"] = True
        proposal = _full_proposal(
            patch=[{"op": "add", "path": "/sections/0/notes/1", "value": {"pitch": "G4"}}]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 1
        assert any("melody lock" in v for v in violations)

    def test_rhythm_lock_catches_duration_changes(self) -> None:
        """Rhythm lock should reject patches to note durationBeats."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["rhythm"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/sections/0/notes/0/durationBeats", "value": 2.0}]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 1
        assert any("rhythm lock" in v for v in violations)

    def test_rhythm_lock_catches_start_beat_changes(self) -> None:
        """Rhythm lock should reject patches to note startBeats."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["rhythm"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/sections/0/notes/0/startBeats", "value": 1.0}]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 1
        assert any("rhythm lock" in v for v in violations)

    def test_tempo_lock_catches_tempo_changes(self) -> None:
        """Tempo lock should reject patches to /tempo."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["tempo"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/tempo", "value": 160}]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 1
        assert any("tempo lock" in v for v in violations)

    def test_key_lock_catches_key_changes(self) -> None:
        """Key lock should reject patches to /key."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["key"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/key", "value": "Dm"}]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 1
        assert any("key lock" in v for v in violations)

    def test_chords_lock_catches_chord_changes(self) -> None:
        """Chords lock should reject patches to /sections/<n>/chords."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["chords"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/sections/0/chords", "value": ["Fmaj"]}]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 1
        assert any("chords lock" in v for v in violations)

    def test_multiple_locks_all_enforced(self) -> None:
        """Multiple active locks should all be enforced simultaneously."""
        ir = _full_ir()
        ir["sections"][0]["locks"].update({
            "melody": True,
            "rhythm": True,
            "chords": True,
            "tempo": True,
            "key": True,
        })
        proposal = _full_proposal(
            patch=[
                {"op": "replace", "path": "/tempo", "value": 150},
                {"op": "replace", "path": "/key", "value": "G"},
                {"op": "add", "path": "/sections/0/notes/1", "value": {"pitch": "A4"}},
                {"op": "replace", "path": "/sections/0/notes/0/durationBeats", "value": 0.5},
                {"op": "replace", "path": "/sections/0/chords", "value": ["Bbmaj"]},
            ]
        )
        violations = check_lock_violations(proposal, ir)
        assert len(violations) >= 5, f"Expected 5+ violations, got {len(violations)}: {violations}"

    def test_lock_only_applies_to_matching_section(self) -> None:
        """Lock on section 0 should not block patches to section 1."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["melody"] = True
        # Add a second section
        ir["sections"].append({
            "id": "sec-2",
            "name": "Chorus",
            "barRange": [9, 16],
            "style": {"genre": "rock", "energy": 0.8, "instruments": ["guitar"]},
            "motifIds": [],
            "chords": [],
            "locks": {"melody": False, "rhythm": False, "chords": False, "tempo": False, "key": False},
        })
        proposal = _full_proposal(
            patch=[{"op": "add", "path": "/sections/1/notes/0", "value": {"pitch": "B4"}}]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == [], f"Section 1 has no melody lock, got: {violations}"

    def test_melody_lock_allows_non_note_patches(self) -> None:
        """Melody lock should allow non-note patches to the same section (e.g., chords)."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["melody"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/sections/0/chords", "value": ["Fmaj"]}]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == [], f"Chords patch should not trigger melody lock, got: {violations}"

    def test_rhythm_lock_allows_pitch_only_changes(self) -> None:
        """Rhythm lock should allow pitch changes that don't touch duration/startBeat."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["rhythm"] = True
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/sections/0/notes/0/pitch", "value": "E4"}]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == [], f"Pitch-only patch should not trigger rhythm lock, got: {violations}"

    def test_empty_sections_no_crash(self) -> None:
        """Empty sections array should not crash lock checking."""
        ir = _full_ir(sections=[])
        proposal = _full_proposal(
            patch=[{"op": "replace", "path": "/sections/0/notes/0/pitch", "value": "E4"}]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == []

    def test_invalid_section_index_no_crash(self) -> None:
        """Patch to a section index that does not exist should not crash."""
        ir = _full_ir()
        proposal = _full_proposal(
            patch=[{"op": "add", "path": "/sections/99/notes/0", "value": {"pitch": "G4"}}]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == []

    def test_non_dict_patch_elements_skipped(self) -> None:
        """Non-dict patch elements should be skipped in lock checking."""
        ir = _full_ir()
        ir["sections"][0]["locks"]["melody"] = True
        proposal = _full_proposal(
            patch=["not-a-dict"]  # type: ignore[list-item]
        )
        violations = check_lock_violations(proposal, ir)
        assert violations == []
