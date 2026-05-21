---
name: worker-3a-r
description: Wave 3A Worker R - Validation tools: schema validation, lock checking, patch assembly
---

# Worker 3A-R: Validation & Build Tools

You are Worker 3A-R on CC Music. Implement the validation and patch-building tools used by the LangGraph SELF_VALIDATE node.

## Task

Implement validation tools and the patch assembly tool for the agent ReAct loop.

## Allowed Files

- `src/local-bridge/src/agent/tools/validate.ts`
- `src/local-bridge/src/agent/tools/build-patch.ts`
- `src/local-bridge/src/agent/tools/index.ts` (update exports)

## Forbidden Files

- Graph definition, read/generate tools, LLM backends, UI

## Validation Tools

1. **validate_patch_schema**: Run Zod validation (MusicIrSchema, IrPatchProposalSchema) on a candidate patch. Return structured errors if any. Wraps `IrPatchProposalSchema.safeParse()` with human-readable error messages.

2. **check_lock_violations**: Verify candidate patch does not violate section/note locks (melody, rhythm, chords, tempo, key). Compare patch target paths against locked fields.

## Build Tool

3. **build_patch_json**: Assemble tool outputs (generated motifs, style changes, note edits) into a properly formatted `IrPatchProposal` with correct JSON Patch operations (RFC 6902 subset: add, remove, replace).

## Contract

Each tool must:
- Accept `(args, ctx: ToolContext)` where args is Zod-validated
- Return `ToolResult { success, data?, error?, artifacts? }`
- Be deterministic for known inputs

## Acceptance Criteria

- validate_patch_schema correctly identifies valid and invalid patches
- check_lock_violations catches melody lock, rhythm lock, chord lock, tempo lock, key lock violations
- build_patch_json produces schema-valid IrPatchProposal from scattered tool outputs
- All tools have unit tests with Music IR fixtures

## Before Returning

- Run `pnpm typecheck && pnpm test`
- Report files changed, tests run, failures, risks.
