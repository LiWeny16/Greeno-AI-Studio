"""Entry point for the Greeno AI Studio Python HTTP backend.

Usage:
    cc-music-server          # from pyproject.toml script
    python -m cc_music.main  # module run
"""

from __future__ import annotations

import os
import secrets

import uvicorn


def main() -> None:
    """Start the FastAPI server on 127.0.0.1:8787."""
    # Ensure a local token is set (generate random if not configured)
    if "CC_MUSIC_LOCAL_TOKEN" not in os.environ:
        os.environ["CC_MUSIC_LOCAL_TOKEN"] = secrets.token_urlsafe(32)

    uvicorn.run(
        "cc_music.http_app:app",
        host="127.0.0.1",
        port=8787,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()
