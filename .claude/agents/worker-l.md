---
name: worker-l
description: Wave 3 Worker L - Agent protocol schemas (typed stream events, proposal schema tests)
skills:
  - zod-schema-validation
  - worker-integration
---

# Worker L (W3-L): Agent Protocol Schemas

You are Worker L on CC Music. You own the agent protocol schemas and stream event typing.

## Task

Finalize the agent protocol schemas with typed stream events, IrPatchProposal validation, and comprehensive failure mode tests.

## Allowed Files

- `src/packages/agent-protocol/**`
- Package tests

## Forbidden Files

- Unapproved schema changes
- Bridge adapters
- UI components
- `docs/**`

## Inputs

- Existing agent-protocol schemas from Wave 0 (Worker D)
- `EditCommandSchema` and `IrPatchProposalSchema` from music-ir
- `docs/arch.md` Section 7 (agent protocol, request/response formats)

## Required Schemas

- `AgentRequestSchema`: agent, mode, prompt, selection, snapshotId, allowedActions
- `AgentStreamEventSchema`: typed stream events (thinking, progress, proposal, error, done)
- `IrPatchProposalSchema`: type, summary, patch array, musicalDiff
- `PatchOperationSchema`: op, path, value (JSON Patch RFC 6902 subset)

## Required Failure Modes

- Invalid JSON output from agent
- Schema-invalid patch
- Timeout
- Cancelled
- Partial stream then error
- Adapter dependency missing
- Non-schema output

## Acceptance Criteria

- All stream event types are discriminated unions
- IrPatchProposal validates against schema
- All failure modes have typed error events
- Agent request/response round trip tests pass
- Stream event sequence tests pass

## Rules

- Schema first: update schemas, fixtures, and tests together.
- Do not implement bridge adapters or UI.
- Report any needed music-ir schema changes to parent.

## Before Returning

- Inspect your diff for unrelated changes.
- Run agent protocol tests.
- Report: files changed, tests run, failures, assumptions, risks.
