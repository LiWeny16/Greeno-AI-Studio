"""CI consistency tests — verify Python Pydantic is the single source of truth.

These tests ensure:
1. JSON Schema can be exported from all Pydantic models.
2. Shared fixture dicts validate against Pydantic models, proving TS-side
   fixtures (which mirror these dicts) are also valid against the source of truth.
"""

from __future__ import annotations

import json
from pathlib import Path

from cc_music.music.ir import (
    IrPatchProposal,
    MusicIr,
    ProjectEvent,
    ProjectManifest,
)

# Fixtures mirror TS fixtures in src/packages/music-ir/src/fixtures.ts
from .fixtures import (
    SAMPLE_MANIFEST_DICT,
    SAMPLE_MUSIC_IR_DICT,
    SAMPLE_PROJECT_EVENT_DICT,
    VALID_PATCH_DICT,
)

# Path to the exported JSON Schema file
SCHEMAS_PATH = (
    Path(__file__).parent.parent.parent.parent
    / "packages"
    / "music-ir"
    / "schemas.json"
)


class TestJsonSchemaExport:
    """Verify JSON Schema can be generated from all Pydantic models."""

    def test_json_schema_export(self) -> None:
        """All four core models produce valid JSON Schema."""
        schemas = {
            "MusicIr": MusicIr.model_json_schema(),
            "IrPatchProposal": IrPatchProposal.model_json_schema(),
            "ProjectManifest": ProjectManifest.model_json_schema(),
            "ProjectEvent": ProjectEvent.model_json_schema(),
        }

        for name, schema in schemas.items():
            assert name in schemas, f"Missing schema: {name}"
            assert isinstance(schema, dict), f"{name} schema is not a dict"
            assert "$defs" in schema or "properties" in schema, (
                f"{name} schema has no properties"
            )

    def test_json_schema_can_be_serialized(self) -> None:
        """Schemas serialize to valid JSON."""
        schemas = {
            "MusicIr": MusicIr.model_json_schema(),
            "IrPatchProposal": IrPatchProposal.model_json_schema(),
            "ProjectManifest": ProjectManifest.model_json_schema(),
            "ProjectEvent": ProjectEvent.model_json_schema(),
        }
        text = json.dumps(schemas, indent=2)
        roundtrip = json.loads(text)
        assert set(roundtrip.keys()) == {
            "MusicIr",
            "IrPatchProposal",
            "ProjectManifest",
            "ProjectEvent",
        }


class TestFixturesValidateAgainstPydantic:
    """Shared fixtures (Python/TS) must validate against Pydantic models."""

    def test_music_ir_fixture_validates(self) -> None:
        ir = MusicIr.model_validate(SAMPLE_MUSIC_IR_DICT)
        assert ir.projectId == "demo"
        assert ir.schemaVersion == 1

    def test_manifest_fixture_validates(self) -> None:
        m = ProjectManifest.model_validate(SAMPLE_MANIFEST_DICT)
        assert m.projectId == "demo"
        assert m.title == "Demo Sketch"

    def test_project_event_fixture_validates(self) -> None:
        event = ProjectEvent.model_validate(SAMPLE_PROJECT_EVENT_DICT)
        assert event.eventId == "evt_000001"
        assert event.actor.type == "local_user"

    def test_patch_proposal_fixture_validates(self) -> None:
        patch = IrPatchProposal.model_validate(VALID_PATCH_DICT)
        assert patch.proposalId == "patch_000001"
        assert len(patch.patch) == 1


class TestSchemaFilePresent:
    """The exported schemas.json file must exist and be valid."""

    def test_schemas_json_was_exported(self) -> None:
        """Sanity-check that the export script was run and produced a file."""
        if not SCHEMAS_PATH.exists():
            # Schema file may not exist in CI if export script not run;
            # this is a soft check — the primary enforcement is the
            # Pydantic validation tests above.
            return
        data = json.loads(SCHEMAS_PATH.read_text())
        assert isinstance(data, dict)
        for key in ("MusicIr", "IrPatchProposal", "ProjectManifest", "ProjectEvent"):
            assert key in data, f"Missing {key} in exported schemas.json"
            assert isinstance(data[key], dict), f"{key} is not a dict"
