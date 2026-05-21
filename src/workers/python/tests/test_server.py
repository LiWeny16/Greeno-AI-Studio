"""Tests for the JSON-RPC server (server.py).

Covers: ping, unknown method, invalid JSON, agent.run with mock prompt,
music.validate with valid IR, and error propagation.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
from pathlib import Path

import pytest

from cc_music.server import process_line
from cc_music.agent.adapters.mock import _SAMPLE_PROPOSAL
from tests.fixtures import SAMPLE_MUSIC_IR_DICT


# ---------------------------------------------------------------------------
# Helper — capture stdout during process_line
# ---------------------------------------------------------------------------


async def _dispatch(line: str) -> list[dict]:
    """Send a JSON line to process_line, return all output lines as parsed dicts."""
    buf = io.StringIO()
    orig = sys.stdout
    sys.stdout = buf
    try:
        await process_line(line)
    finally:
        sys.stdout = orig

    raw = buf.getvalue()
    if not raw.strip():
        return []
    return [json.loads(ln) for ln in raw.strip().split("\n") if ln.strip()]


def _first_result(outputs: list[dict]) -> dict | None:
    """Return the first result-typed output, or None."""
    for o in outputs:
        if o.get("type") == "result":
            return o
    return None


def _first_error(outputs: list[dict]) -> dict | None:
    """Return the first error-typed output, or None."""
    for o in outputs:
        if o.get("type") == "error":
            return o
    return None


def _stream_events(outputs: list[dict]) -> list[dict]:
    """Return all stream_event outputs."""
    return [o for o in outputs if o.get("type") == "stream_event"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPing:
    """ping returns pong."""

    async def test_ping_returns_pong(self) -> None:
        outputs = await _dispatch(json.dumps({"id": "r1", "method": "ping", "params": {}}))

        result = _first_result(outputs)
        assert result is not None, "Expected a result output"
        assert result["id"] == "r1"
        assert result["data"] == {"pong": True}


class TestUnknownMethod:
    """Unknown method returns error."""

    async def test_unknown_method_returns_error(self) -> None:
        outputs = await _dispatch(
            json.dumps({"id": "r2", "method": "nosuch.method", "params": {}})
        )

        error = _first_error(outputs)
        assert error is not None, "Expected an error output"
        assert error["id"] == "r2"
        assert error["error"]["code"] == "unknown_method"


class TestInvalidJson:
    """Invalid JSON returns error."""

    async def test_invalid_json_returns_error(self) -> None:
        outputs = await _dispatch("{ this is not valid json }")

        error = _first_error(outputs)
        assert error is not None, "Expected an error output"
        assert error["error"]["code"] == "invalid_json"


class TestAgentRun:
    """agent.run with mock prompt returns a valid proposal."""

    async def test_agent_run_make_bars_darker_produces_proposal(self) -> None:
        prompt = "make bars 9-16 darker"
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r3",
                    "method": "agent.run",
                    "params": {
                        "prompt": prompt,
                        "context": {
                            "snapshot": {"sections": [], "tracks": []},
                            "selection": {"barRange": [9, 16]},
                        },
                    },
                }
            )
        )

        # Should have stream events (text, tool_result, proposal) plus a final result
        stream = _stream_events(outputs)
        assert len(stream) >= 1, "Expected at least one stream event"

        result = _first_result(outputs)
        assert result is not None, "Expected a final result output"
        assert result["id"] == "r3"
        assert result["data"]["success"] is True
        assert result["data"]["proposal"] is not None
        assert "patch" in result["data"]["proposal"]
        assert "musicalDiff" in result["data"]["proposal"]

    async def test_agent_run_schema_invalid_prompt_retries(self) -> None:
        """fail:schema_invalid produces invalid proposal, retries, then succeeds."""
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r4",
                    "method": "agent.run",
                    "params": {
                        "prompt": "fail:schema_invalid",
                        "context": {
                            "snapshot": {"sections": [], "tracks": []},
                            "selection": {},
                            "max_iterations": 10,
                        },
                    },
                }
            )
        )

        stream = _stream_events(outputs)
        # Should have validation_error event(s) from the first attempt
        val_errors = [
            e for e in stream if e.get("data", {}).get("type") == "validation_error"
        ]
        assert len(val_errors) >= 1, "Expected validation_error stream events"

        result = _first_result(outputs)
        assert result is not None
        assert result["data"]["success"] is True

    async def test_agent_run_timeout_hits_max_iterations(self) -> None:
        """fail:timeout never produces proposal, hits max_iterations."""
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r5",
                    "method": "agent.run",
                    "params": {
                        "prompt": "fail:timeout",
                        "context": {
                            "snapshot": {"sections": [], "tracks": []},
                            "selection": {},
                            "max_iterations": 3,
                        },
                    },
                }
            )
        )

        result = _first_result(outputs)
        assert result is not None
        assert result["data"]["success"] is False
        assert result["data"]["error"] == "max_iterations_exceeded"

    async def test_agent_run_unknown_prompt_exhausts(self) -> None:
        """Unknown prompt yields empty mock sequence -> max_iterations error."""
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r6",
                    "method": "agent.run",
                    "params": {
                        "prompt": "nonexistent prompt key",
                        "context": {
                            "snapshot": {"sections": [], "tracks": []},
                            "selection": {},
                            "max_iterations": 2,
                        },
                    },
                }
            )
        )

        result = _first_result(outputs)
        assert result is not None
        assert result["data"]["success"] is False


class TestMusicValidate:
    """music.validate with valid IR returns success."""

    async def test_validate_valid_ir_returns_success(self) -> None:
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r7",
                    "method": "music.validate",
                    "params": {"data": SAMPLE_MUSIC_IR_DICT},
                }
            )
        )

        result = _first_result(outputs)
        assert result is not None
        assert result["data"]["valid"] is True
        assert result["data"]["errors"] == []

    async def test_validate_invalid_ir_returns_errors(self) -> None:
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r8",
                    "method": "music.validate",
                    "params": {"data": {"schemaVersion": 1}},
                }
            )
        )

        result = _first_result(outputs)
        assert result is not None
        assert result["data"]["valid"] is False
        assert len(result["data"]["errors"]) > 0


class TestMusicTranspose:
    """music.transpose shifts pitches."""

    async def test_transpose_notes_up(self) -> None:
        notes = [
            {"pitch": "C4", "startBeat": 0.0, "durationBeats": 0.5, "velocity": 0.8},
            {"pitch": "E4", "startBeat": 0.5, "durationBeats": 0.5, "velocity": 0.7},
        ]
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r9",
                    "method": "music.transpose",
                    "params": {"notes": notes, "semitones": 2},
                }
            )
        )

        result = _first_result(outputs)
        assert result is not None
        transposed = result["data"]["notes"]
        assert transposed[0]["pitch"] == "D4"
        assert transposed[1]["pitch"] == "F#4"

    async def test_transpose_notes_down(self) -> None:
        notes = [
            {"pitch": "C4", "startBeat": 0.0, "durationBeats": 1.0, "velocity": 0.8},
        ]
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r10",
                    "method": "music.transpose",
                    "params": {"notes": notes, "semitones": -1},
                }
            )
        )

        result = _first_result(outputs)
        assert result is not None
        assert result["data"]["notes"][0]["pitch"] == "B3"


class TestMidiRoundTrip:
    """MIDI import/export round-trips correctly."""

    async def test_midi_import_and_export_roundtrip(self) -> None:
        import miditoolkit

        # Create a small MIDI file in a temp directory
        with tempfile.TemporaryDirectory() as tmpdir:
            src_path = Path(tmpdir) / "input.mid"
            dest_path = Path(tmpdir) / "output.mid"

            # Build a minimal MIDI with one track and two notes
            midi = miditoolkit.MidiFile(ticks_per_beat=480)
            midi.tempo_changes.append(miditoolkit.TempoChange(tempo=120.0, time=0))
            midi.time_signature_changes.append(
                miditoolkit.TimeSignature(numerator=4, denominator=4, time=0)
            )
            inst = miditoolkit.Instrument(program=0, is_drum=False, name="Test")
            inst.notes = [
                miditoolkit.Note(pitch=60, start=0, end=480, velocity=100),      # C4
                miditoolkit.Note(pitch=64, start=480, end=960, velocity=80),     # E4
            ]
            midi.instruments.append(inst)
            midi.dump(src_path)

            # --- Import ---
            outputs = await _dispatch(
                json.dumps(
                    {
                        "id": "r11",
                        "method": "midi.import",
                        "params": {"filepath": str(src_path)},
                    }
                )
            )

            result = _first_result(outputs)
            assert result is not None
            data = result["data"]
            assert "tempo" in data
            assert "tracks" in data
            assert len(data["tracks"]) == 1
            assert data["tracks"][0]["name"] == "Test"
            assert len(data["tracks"][0]["notes"]) == 2

            # --- Export ---
            outputs2 = await _dispatch(
                json.dumps(
                    {
                        "id": "r12",
                        "method": "midi.export",
                        "params": {
                            "data": {
                                "tempo": 120.0,
                                "time_signature": {"numerator": 4, "denominator": 4},
                                "tracks": data["tracks"],
                            },
                            "filepath": str(dest_path),
                        },
                    }
                )
            )

            result2 = _first_result(outputs2)
            assert result2 is not None
            assert dest_path.is_file()

            # --- Re-import to verify fidelity ---
            outputs3 = await _dispatch(
                json.dumps(
                    {
                        "id": "r13",
                        "method": "midi.import",
                        "params": {"filepath": str(dest_path)},
                    }
                )
            )

            result3 = _first_result(outputs3)
            assert result3 is not None
            data3 = result3["data"]
            notes3 = data3["tracks"][0]["notes"]
            assert len(notes3) == 2
            assert notes3[0]["pitch"] == "C4"
            assert notes3[1]["pitch"] == "E4"


class TestHandlerError:
    """Handler-level exceptions are caught and returned as errors."""

    async def test_midi_import_missing_file_returns_error(self) -> None:
        outputs = await _dispatch(
            json.dumps(
                {
                    "id": "r14",
                    "method": "midi.import",
                    "params": {"filepath": "/nonexistent/path/file.mid"},
                }
            )
        )

        error = _first_error(outputs)
        assert error is not None
        assert error["id"] == "r14"
        assert error["error"]["code"] == "handler_error"


class TestResultShape:
    """Result and error outputs have the expected top-level shape."""

    async def test_result_has_type_id_data(self) -> None:
        outputs = await _dispatch(
            json.dumps({"id": "r15", "method": "ping", "params": {}})
        )
        result = _first_result(outputs)
        assert result is not None
        assert set(result.keys()) == {"type", "id", "data"}

    async def test_error_has_type_id_error(self) -> None:
        outputs = await _dispatch(
            json.dumps({"id": "r16", "method": "unknown.x", "params": {}})
        )
        error = _first_error(outputs)
        assert error is not None
        assert set(error.keys()) == {"type", "id", "error"}
        assert "code" in error["error"]
