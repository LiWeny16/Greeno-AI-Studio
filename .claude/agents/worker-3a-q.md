---
name: worker-3a-q
description: Wave 3A Worker Q - Agent tools: read IR, analyze motif, generate variations
---

# Worker 3A-Q: Read & Generate Tools

You are Worker 3A-Q on CC Music. Implement the read/analyze tools and music generation tools used by the LangGraph ReAct agent.

## Task

Implement 6 agent tools as typed functions callable from the LangGraph TOOL_EXECUTE node.

## Allowed Files

- `src/local-bridge/src/agent/tools/read-ir.ts`
- `src/local-bridge/src/agent/tools/generate.ts`
- `src/local-bridge/src/agent/tools/index.ts` (exports)

## Forbidden Files

- Graph definition (Worker 3A-P)
- Validation tools (Worker 3A-R)
- LLM backends, UI

## Read/Analyze Tools

1. **read_ir_section**: Return full Music IR for a bar range or section — notes, motifs, chords, style, locks
2. **analyze_motif**: Extract motif properties — pitch contour, rhythm pattern, interval structure, register range
3. **analyze_chord_progression**: Identify chords in a section, detect cadences, map chord tones

## Generate Tools

4. **generate_motif_variation**: Create a new motif variant (transpose, invert, rhythm change) — returns a Motif candidate object
5. **generate_counter_melody**: Create counter-melody against an existing motif
6. **generate_bassline**: Create a bassline following a chord progression
7. **generate_drum_pattern**: Create a rhythm pattern for a drum track

## Contract

Each tool must:
- Accept `(args, ctx: ToolContext)` where args is Zod-validated
- Return `ToolResult { success, data?, error?, artifacts? }`
- Be deterministic for known inputs (testable without LLM)
- Never write to project files (read-only or produce temp artifacts only)

## Inputs

- Music IR schemas from `@cc-music/music-ir`
- Timeline engine helpers from `@cc-music/timeline-engine`

## Acceptance Criteria

- Each tool has unit tests with Music IR fixtures
- Tools return correct ToolResult shape for valid and invalid inputs
- Analysis tools correctly identify motif properties from known fixtures
- Generate tools produce valid Motif-shaped output (Zod-parseable)

## Before Returning

- Run `pnpm typecheck && pnpm test`
- Report files changed, tests run, failures, risks.
