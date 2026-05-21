---
name: worker-3a-q
description: Wave 3A Worker Q - Python agent tools (10 music-domain tools, tool registry, dispatch function)
---

# Worker 3A-Q: Python Agent Tools

You are Worker 3A-Q on CC Music. Implement all 10 music-domain tools for the ReAct agent loop in Python. Tools are callable by the LLM during the ReAct loop and must return structured results.

## Task

Implement `src/workers/python/cc_music/agent/tools.py` with 10 music-domain tools, a `Tool` protocol, a tool registry with decorator-based registration, and a `dispatch_tool` function. No TypeScript. No LangGraph.

## Allowed Files

- `src/workers/python/cc_music/agent/tools.py`
- `src/workers/python/cc_music/agent/__init__.py` (update exports if needed)

## Forbidden Files

- ReAct loop core (Worker 3A-P)
- LLM adapters (Worker 3A-R)
- JSON-RPC server (Worker 3A-S)
- `docs/**`, `src/studio-web/**`, any TypeScript files

## Inputs

- Music IR schemas from `src/workers/python/cc_music/music/ir.py`
- `docs/arch.md` Section 7 (agent tool contract)

## Core Types

```python
class ToolResult(BaseModel):
    success: bool
    data: Any = None
    error: str | None = None

class Tool(Protocol):
    name: str
    description: str
    parameters: dict        # JSON Schema for LLM function calling
    async def execute(args: dict, ctx: dict) -> dict: ...
```

## Tool Registry & Dispatch

Use a decorator-based registry pattern:

```python
TOOL_REGISTRY: dict[str, Tool] = {}

def register(name: str, description: str, parameters: dict):
    """Decorator that registers an async handler as a Tool."""
    def decorator(fn):
        TOOL_REGISTRY[name] = SimpleTool(name, description, parameters, fn)
        return fn
    return decorator

async def dispatch_tool(name: str, args: dict, ctx: dict) -> dict:
    """Find tool by name, execute, return result dict. Catch errors."""
```

A `SimpleTool` dataclass should implement the `Tool` protocol, wrapping the handler function.

## The 10 Music-Domain Tools

### Read/Analyze Tools (3)

**1. read_ir_section**
- Purpose: Return full Music IR for a bar range or section
- Input: `{bar_range?: [start, end], section_id?: str}`
- Output: `{success, data: {notes, motifs, chords, style, locks}}`
- Must be read-only; never mutate project state

**2. analyze_motif**
- Purpose: Extract motif properties — pitch contour, rhythm pattern, interval structure, register range
- Input: `{motif_id: str, snapshot: dict}`
- Output: `{success, data: {pitch_contour: list[int], rhythm_pattern: list[float], intervals: list[int], register: [low, high], note_count: int}}`
- Must be deterministic for known fixture inputs

**3. analyze_chord_progression**
- Purpose: Identify chords in a section, detect cadences, map chord tones
- Input: `{section_id: str, snapshot: dict}`
- Output: `{success, data: {chords: list[{root, quality, inversion, start_beat, duration}], cadences: list[{type, bar}], key: str}}`
- Must detect common cadences: authentic (V-I), plagal (IV-I), half (ending on V), deceptive (V-vi)

### Generate Tools (4)

**4. generate_motif_variation**
- Purpose: Create a new motif variant (transpose, invert, rhythm change, retrograde)
- Input: `{motif_id: str, variation_type: str, snapshot: dict}`
- Output: `{success, data: {motif: {id, notes: [{pitch, start, duration, velocity}], metadata}}}`
- Variation types: "transpose", "invert", "retrograde", "rhythm_augment", "rhythm_diminish"
- Must produce valid Motif-shaped output (parseable by music IR schemas)

**5. generate_counter_melody**
- Purpose: Create counter-melody against an existing motif using species counterpoint rules
- Input: `{motif_id: str, snapshot: dict, species: str}`
- Output: `{success, data: {counter_motif: {id, notes: [...]}}}`
- Species: "first" (note-against-note), "second" (two-against-one), "fifth" (florid)

**6. generate_bassline**
- Purpose: Create a bassline following a chord progression
- Input: `{chord_progression: list[str], snapshot: dict, style: str}`
- Output: `{success, data: {bassline: {id, notes: [{pitch, start, duration, velocity}]}}}`
- Style options: "walking", "root_fifth", "arpeggiated", "pedal"

**7. generate_drum_pattern**
- Purpose: Create a rhythm pattern for a drum track
- Input: `{style: str, bars: int, time_signature: str, snapshot: dict}`
- Output: `{success, data: {pattern: {id, hits: [{drum_type, beat, velocity}]}}}`
- Style options: "rock", "jazz_swing", "electronic", "hip_hop", "latin"
- Drum types: "kick", "snare", "hihat_closed", "hihat_open", "tom_high", "tom_low", "crash", "ride"

### Validation & Build Tools (3)

**8. validate_patch_schema**
- Purpose: Validate a candidate IrPatchProposal against schema rules
- Input: `{proposal: dict, snapshot: dict}`
- Output: `{success: true, data: {valid: true, errors: []}}` or `{success: true, data: {valid: false, errors: [...]}}`
- Checks: proposal is dict, has "patch" (list of RFC 6902 ops), each op has valid "op" field, has "musicalDiff"
- Returns human-readable error messages for each violation

**9. check_lock_violations**
- Purpose: Verify candidate patch does not violate section/note locks
- Input: `{proposal: dict, snapshot: dict}`
- Output: `{success, data: {violations: [{lock_type, path, message}]}}`
- Lock types to check: melody, rhythm, chords, tempo, key
- Compare patch target paths against locked fields in snapshot

**10. build_patch_json**
- Purpose: Assemble scattered tool outputs into a properly formatted IrPatchProposal
- Input: `{operations: list[{op, path, value}], description: str, tool_outputs: dict}`
- Output: `{success, data: {proposal: {patch: [...], musicalDiff: {...}}}}`
- Must produce schema-valid IrPatchProposal with correct JSON Patch operations (RFC 6902 subset: add, remove, replace, move, copy, test)
- Auto-compute musicalDiff summary from operations list

## Contract

Each tool must:
- Accept `(args, ctx)` where ctx includes `{"snapshot": dict}`
- Return `dict` with at least `{"success": bool}` and either `data` or `error`
- Be deterministic for known fixture inputs (testable without LLM)
- Never write to project files (read-only or produce temp artifacts only)
- Handle missing/invalid inputs gracefully with structured error output

## Acceptance Criteria

- All 10 tools registered in TOOL_REGISTRY
- `dispatch_tool("read_ir_section", {...}, ctx)` returns valid result
- `dispatch_tool("nonexistent", {}, ctx)` returns `{success: false, error: "Unknown tool: ..."}`
- Analysis tools correctly identify motif properties from known Music IR fixtures
- Generate tools produce valid motif/bassline/pattern-shaped output
- `validate_patch_schema` catches: missing patch, non-list patch, invalid op type, missing musicalDiff
- `check_lock_violations` catches: melody lock violation, rhythm lock violation, chord lock violation, tempo lock violation, key lock violation
- `build_patch_json` produces schema-valid IrPatchProposal from scattered outputs
- All tools have unit tests in `tests/agent/test_tools.py`

## Before Returning

- Run `python -m pytest tests/agent/test_tools.py -v`
- Report files changed, tests run, failures, risks.
