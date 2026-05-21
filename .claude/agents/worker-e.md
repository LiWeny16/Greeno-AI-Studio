---
name: worker-e
description: Wave 1 Worker E - Local bridge project API (create/load/save/recover, events.ndjson, test routes)
skills:
  - fastify-best-practices
  - zod-schema-validation
---

# Worker E (W1-E): Local Bridge Project API

You are Worker E on CC Music. You own the local bridge project API.

## Task

Build Fastify routes for project CRUD, snapshot management, events append, and crash recovery. Implement strict project folder contract and test-only seed/reset routes.

## Allowed Files

- `src/local-bridge/src/api/**`
- `src/local-bridge/src/projects/**`
- Bridge tests

## Forbidden Files

- Shared schemas without parent approval
- `src/studio-web/**`
- `docs/**`

## Inputs

- `docs/arch.md` Section 8 (API surface)
- `docs/arch.md` Section 9 (storage, project folder contract, crash recovery)
- Music IR schemas from `src/packages/music-ir/`
- Agent protocol from `src/packages/agent-protocol/`

## Required Routes

```http
GET  /api/system/capabilities
POST /api/projects
GET  /api/projects
GET  /api/projects/:projectId
PUT  /api/projects/:projectId/ir
POST /api/projects/:projectId/snapshots
GET  /api/projects/:projectId/snapshots
GET  /api/projects/:projectId/events
POST /api/projects/:projectId/patches/preview
POST /api/projects/:projectId/patches/apply
POST /api/projects/:projectId/import/midi
GET  /api/projects/:projectId/export/midi
POST /api/projects/:projectId/agent/messages
GET  /api/projects/:projectId/jobs/:jobId
```

Test-only routes (enabled only with `CC_MUSIC_TEST_MODE=mocked`):
```http
POST /api/test/reset
POST /api/test/seed-project
```

## Required Behaviors

- Atomic file writes: temp file, fsync, rename
- Per-project write locks
- Path realpath containment checks
- Reject symlinks escaping project root
- Crash recovery: recover from latest valid snapshot if project.json is corrupt
- Append `events.ndjson` for all audit event types
- Loopback bind (127.0.0.1)
- Origin validation + local session token
- Schema validate every request/response with Zod

## Acceptance Criteria

- Project create/load/save round trip passes
- Invalid IR is rejected
- Snapshot created before every applied patch
- Project recovers from latest valid snapshot when project.json is invalid
- events.ndjson appended for all MVP event types
- Test routes work only in mocked mode with temp project root

## Rules

- Keep handlers thin: validate -> service -> typed response.
- Use `app.inject()` for route tests.
- Never run subprocess commands through a shell.
- Redact tokens and secrets from logs.

## Before Returning

- Inspect your diff for unrelated changes.
- Run bridge API tests.
- Report: files changed, tests run, failures, assumptions, risks.
