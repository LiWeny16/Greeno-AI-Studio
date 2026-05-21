# Agent Integration

Agent intelligence lives in the Python engine: `src/workers/python/cc_music/agent/`

This directory contains only the bridge-side JSON-RPC client that communicates with the Python subprocess via stdin/stdout.

See docs/arch.md Section 7 for the full agent architecture.
