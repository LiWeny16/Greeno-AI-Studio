"""Tests for the FastAPI HTTP backend (http_app.py).

Covers:
  - Health endpoint
  - Security middleware (origin, token)
  - Project CRUD: create -> list -> get -> update
  - Snapshot create + list
  - Events read
  - Patch preview and apply
  - MIDI import and export
  - Agent message endpoint
  - Middleware: reject null origin, reject bad token
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest


TEST_TOKEN = "test-token-12345"


@pytest.fixture
def tmp_project_root():
    """Create a temporary project root + fix local token so the app uses a known value."""
    with tempfile.TemporaryDirectory() as tmpdir:
        _set_env("CC_MUSIC_PROJECT_ROOT", tmpdir)
        _set_env("CC_MUSIC_LOCAL_TOKEN", TEST_TOKEN)
        yield Path(tmpdir)


@pytest.fixture
def client(tmp_project_root):
    """Return a TestClient, re-importing the app module for each test to pick
    up the temporary PROJECT_ROOT and LOCAL_TOKEN."""
    import importlib
    import cc_music.http_app as app_module

    importlib.reload(app_module)
    from fastapi.testclient import TestClient

    with TestClient(app_module.app) as c:
        yield c


@pytest.fixture
def auth_headers():
    """Headers for an authorized request from a valid origin."""
    return {
        "Origin": "http://localhost:5173",
        "X-Local-Token": TEST_TOKEN,
    }


def _set_env(key: str, value: str):
    import os as _os
    _os.environ[key] = value


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_returns_ok(self, client):
        """Health endpoint works without auth (bypasses middleware)."""
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "cc-music" in data.get("service", "")

    def test_capabilities_requires_auth(self, client, auth_headers):
        r = client.get("/api/system/capabilities", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "codex" in data
        assert "claude" in data


# ---------------------------------------------------------------------------
# Security middleware
# ---------------------------------------------------------------------------


class TestSecurity:
    def test_reject_no_origin(self, client):
        r = client.get("/api/projects")
        assert r.status_code == 403

    def test_reject_null_origin(self, client):
        r = client.get("/api/projects", headers={"Origin": "null"})
        assert r.status_code == 403

    def test_reject_bad_origin(self, client):
        r = client.get(
            "/api/projects",
            headers={
                "Origin": "https://evil.com",
                "X-Local-Token": "test-token-12345",
            },
        )
        assert r.status_code == 403

    def test_reject_missing_token(self, client):
        r = client.get(
            "/api/projects",
            headers={"Origin": "http://localhost:5173"},
        )
        assert r.status_code == 401

    def test_reject_bad_token(self, client):
        r = client.get(
            "/api/projects",
            headers={
                "Origin": "http://localhost:5173",
                "X-Local-Token": "wrong-token",
            },
        )
        assert r.status_code == 401

    def test_allow_valid_origin_and_token(self, client, auth_headers):
        r = client.get("/api/projects", headers=auth_headers)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------


class TestProjectCRUD:
    def test_create_project(self, client, auth_headers):
        r = client.post(
            "/api/projects",
            json={
                "title": "My Test Project",
                "tempo": 140,
                "key": "D minor",
                "timeSignature": "3/4",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "manifest" in data
        assert "ir" in data
        assert data["manifest"]["title"] == "My Test Project"
        assert data["ir"]["tempo"] == 140
        assert data["ir"]["key"] == "D minor"
        assert data["ir"]["timeSignature"] == "3/4"
        assert data["manifest"]["projectId"].startswith("proj_")

    def test_create_project_defaults(self, client, auth_headers):
        r = client.post(
            "/api/projects",
            json={"title": "Default Project"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ir"]["tempo"] == 120
        assert data["ir"]["key"] == "C major"
        assert data["ir"]["timeSignature"] == "4/4"

    def test_create_project_missing_title(self, client, auth_headers):
        r = client.post("/api/projects", json={}, headers=auth_headers)
        assert r.status_code == 400

    def test_create_project_invalid_tempo(self, client, auth_headers):
        r = client.post(
            "/api/projects",
            json={"title": "Bad", "tempo": 999},
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_list_projects(self, client, auth_headers, tmp_project_root):
        client.post("/api/projects", json={"title": "Alpha"}, headers=auth_headers)
        client.post("/api/projects", json={"title": "Beta"}, headers=auth_headers)
        r = client.get("/api/projects", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["projects"]) == 2

    def test_get_project(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Get Me"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.get(f"/api/projects/{pid}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["manifest"]["projectId"] == pid
        assert "ir" in data

    def test_get_project_not_found(self, client, auth_headers):
        r = client.get("/api/projects/nonexistent", headers=auth_headers)
        assert r.status_code == 404

    def test_update_project_ir(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Update Me"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        ir = create_r.json()["ir"]
        ir["title"] = "Updated Title"

        r = client.put(f"/api/projects/{pid}/ir", json=ir, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["ir"]["title"] == "Updated Title"

    def test_update_project_invalid_ir(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Invalid Update"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.put(
            f"/api/projects/{pid}/ir",
            json={"schemaVersion": 99, "projectId": "x"},
            headers=auth_headers,
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Snapshots
# ---------------------------------------------------------------------------


class TestSnapshots:
    def test_create_snapshot(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Snapshot Me"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.post(f"/api/projects/{pid}/snapshots", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["snapshotId"].startswith("snap_")
        assert "ir" in data

    def test_list_snapshots(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Snapshot List"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        client.post(f"/api/projects/{pid}/snapshots", headers=auth_headers)
        client.post(f"/api/projects/{pid}/snapshots", headers=auth_headers)

        r = client.get(f"/api/projects/{pid}/snapshots", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()["snapshots"]) == 2


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class TestEvents:
    def test_read_events(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Events Project"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.get(f"/api/projects/{pid}/events", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["events"]) >= 1
        assert data["events"][0]["type"] == "project_created"


# ---------------------------------------------------------------------------
# Patches (preview + apply)
# ---------------------------------------------------------------------------


class TestPatches:
    @pytest.fixture
    def project_id(self, client, auth_headers):
        """Create a project with a section and tracks, return project_id."""
        r = client.post("/api/projects", json={"title": "Patch Test"}, headers=auth_headers)
        pid = r.json()["manifest"]["projectId"]

        ir = r.json()["ir"]
        ir["sections"] = [
            {
                "id": "sec_a",
                "name": "A",
                "barRange": [1, 8],
                "style": {"genre": "ambient", "energy": 0.5, "instruments": ["piano"]},
                "motifIds": ["motif_main"],
                "chords": ["Am", "F", "C", "G"],
                "locks": {
                    "melody": False,
                    "rhythm": False,
                    "chords": False,
                    "tempo": True,
                    "key": True,
                },
            }
        ]
        ir["motifs"] = [
            {
                "id": "motif_main",
                "notes": [
                    {
                        "pitch": "A4",
                        "startBeat": 0.0,
                        "durationBeats": 0.5,
                        "velocity": 0.8,
                    }
                ],
                "source": {"type": "manual"},
                "lockStrength": 0.5,
            }
        ]
        ir["tracks"] = [
            {
                "id": "track_piano",
                "name": "Piano",
                "type": "midi",
                "instrument": "piano",
                "clips": [],
            }
        ]
        client.put(f"/api/projects/{pid}/ir", json=ir, headers=auth_headers)
        return pid

    def test_patch_preview(self, client, auth_headers, project_id):
        r = client.post(
            f"/api/projects/{project_id}/patches/preview",
            json={
                "summary": "Change genre of section A",
                "patch": [
                    {
                        "op": "replace",
                        "path": "/sections/0/style/genre",
                        "value": "dark minimal electronic",
                    }
                ],
                "musicalDiff": {"notesAdded": 4, "notesRemoved": 2, "preservedMotifs": []},
            },
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "proposal" in data
        assert "previewIr" in data
        assert data["previewIr"]["sections"][0]["style"]["genre"] == "dark minimal electronic"

    def test_patch_preview_invalid_patch(self, client, auth_headers, project_id):
        r = client.post(
            f"/api/projects/{project_id}/patches/preview",
            json={
                "summary": "Bad patch",
                "patch": [{"op": "invalid_op", "path": "/x", "value": 1}],
            },
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_patch_apply(self, client, auth_headers, project_id):
        r = client.post(
            f"/api/projects/{project_id}/patches/apply",
            json={
                "summary": "Change genre of section A",
                "patch": [
                    {
                        "op": "replace",
                        "path": "/sections/0/style/genre",
                        "value": "dark minimal electronic",
                    }
                ],
                "musicalDiff": {"notesAdded": 4, "notesRemoved": 2},
            },
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "snapshotId" in data
        assert "proposalId" in data
        assert data["ir"]["sections"][0]["style"]["genre"] == "dark minimal electronic"

        # Verify persistence
        get_r = client.get(f"/api/projects/{project_id}", headers=auth_headers)
        assert get_r.json()["ir"]["sections"][0]["style"]["genre"] == "dark minimal electronic"


# ---------------------------------------------------------------------------
# MIDI import/export
# ---------------------------------------------------------------------------


class TestMidi:
    def test_midi_import(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Midi Import"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.post(f"/api/projects/{pid}/import/midi", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "ir" in data
        assert len(data["ir"]["sections"]) > 0

    def test_midi_export(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Midi Export"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.get(f"/api/projects/{pid}/export/midi", headers=auth_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type") == "application/octet-stream"


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------


class TestAgent:
    def test_agent_messages_mock_produces_proposal(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Agent Test"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.post(
            f"/api/projects/{pid}/agent/messages",
            json={"prompt": "make bars 9-16 darker", "selection": {"barRange": [9, 16]}},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "proposal" in data
        assert "streamEvents" in data
        assert len(data["streamEvents"]) >= 1

    def test_agent_messages_empty_prompt(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Agent Empty"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.post(
            f"/api/projects/{pid}/agent/messages",
            json={"prompt": ""},
            headers=auth_headers,
        )
        assert r.status_code == 400

    def test_agent_messages_timeout(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Agent Timeout"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.post(
            f"/api/projects/{pid}/agent/messages",
            json={"prompt": "fail:timeout", "selection": {}},
            headers=auth_headers,
        )
        assert r.status_code == 422
        data = r.json()
        assert "error" in data


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


class TestJobs:
    def test_get_job_not_found(self, client, auth_headers):
        create_r = client.post("/api/projects", json={"title": "Jobs Test"}, headers=auth_headers)
        pid = create_r.json()["manifest"]["projectId"]

        r = client.get(f"/api/projects/{pid}/jobs/nonexistent_job", headers=auth_headers)
        assert r.status_code == 404
