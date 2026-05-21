"""Dump Pydantic models as JSON Schema for TypeScript consumption."""

from __future__ import annotations

import json
from pathlib import Path

from cc_music.music.ir import IrPatchProposal, MusicIr, ProjectEvent, ProjectManifest

schemas = {
    "MusicIr": MusicIr.model_json_schema(),
    "IrPatchProposal": IrPatchProposal.model_json_schema(),
    "ProjectManifest": ProjectManifest.model_json_schema(),
    "ProjectEvent": ProjectEvent.model_json_schema(),
}

# Write to shared location: src/packages/music-ir/schemas.json
out = (
    Path(__file__).parent.parent.parent.parent.parent
    / "packages"
    / "music-ir"
    / "schemas.json"
)
out.write_text(json.dumps(schemas, indent=2))
print(f"JSON Schema written to {out}")
