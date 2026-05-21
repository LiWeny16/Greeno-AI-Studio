"""Shared test fixtures and configuration."""

import pytest


@pytest.fixture
def sample_project_data() -> dict:
    """Return minimal valid project data for tests."""
    return {
        "schemaVersion": 1,
        "title": "Test Project",
        "tempo": 120,
        "key": "C",
    }
