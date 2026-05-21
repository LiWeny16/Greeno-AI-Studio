# Agent Instructions

Follow `CLAUDE.md` for product law, coding standards, schema-first workflow, tests, and done criteria.

Additional Codex guidance:

- Read `docs/plan.md`, `docs/arch.md`, `docs/path.md`, and `docs/ownership.md` before implementation tasks.
- Read `docs/uiux.md` before frontend or Playwright tasks.
- Keep work scoped to the assigned files.
- Prefer mocked workers and deterministic fixtures.
- Do not introduce real AI/audio dependencies into default tests.
- Do not broaden the MVP beyond MIDI-first arrangement, motif editing, agent patch preview/apply, undo, playback, and MIDI export.
- Do not add unapproved framework dependencies; use the dependency baseline in `docs/arch.md`.
