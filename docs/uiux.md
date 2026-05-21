# CC Music UI/UX Engineering Spec

Last updated: 2026-05-21

## 1. Product Feel

CC Music is a creation tool, not a landing page. The first screen is the editor.

Target feel:

- Dense but calm.
- Fast to scan.
- Built for repeated editing.
- Keyboard-friendly.
- Timeline and piano roll are the visual center.
- Agent output is inspectable and reversible, not magical.

Avoid:

- Marketing hero sections.
- Decorative cards.
- One-color purple/blue gradients.
- In-app explanatory copy about how features work.
- Large rounded pill buttons for normal editor actions.
- Full DAW complexity in MVP.

## 2. UI Stack

Use this stack for `src/studio-web`:

```text
React 19
TypeScript
Vite
Tailwind CSS
shadcn/ui component style
Radix UI primitives
lucide-react icons
class-variance-authority
tailwind-merge
clsx
Zustand
TanStack Query
React Hook Form
@hookform/resolvers/zod
Konva / react-konva
Tone.js
@tonejs/midi
Playwright
Vitest
```

Component rule:

```text
Use shadcn/ui-style local components built on Radix primitives.
Do not import a heavy all-in-one component framework.
```

Rationale:

- Radix gives accessibility and behavior.
- shadcn-style local components keep ownership in the repo.
- Tailwind keeps visual iteration fast.
- Lucide keeps icon language consistent.

## 3. Component Library Standard

Create local primitives under:

```text
src/studio-web/src/components/ui/
```

Initial components:

```text
button.tsx
icon-button.tsx
toggle.tsx
toggle-group.tsx
slider.tsx
input.tsx
textarea.tsx
select.tsx
tabs.tsx
tooltip.tsx
dropdown-menu.tsx
context-menu.tsx
dialog.tsx
popover.tsx
scroll-area.tsx
separator.tsx
badge.tsx
progress.tsx
resizable-panels.tsx
```

Rules:

- Use Radix primitives when behavior is nontrivial.
- Use simple local components when Radix adds no value.
- Do not create a design system package until duplication proves it is needed.
- Keep component APIs small: `variant`, `size`, `disabled`, `aria-label`, `data-testid`.
- Use `forwardRef` for reusable primitives.
- Every icon-only button must have an accessible label and tooltip.

## 4. Icons

Use `lucide-react`.

Default icon sizes:

```text
toolbar icon: 18px
compact button icon: 16px
panel header icon: 16px
empty state icon: 24px max
```

Recommended icon map:

```text
Play, Pause, Square, SkipBack, SkipForward
Save, FolderOpen, Download, Upload
Undo2, Redo2
Scissors, Copy, Clipboard, Trash2
MousePointer2, Pencil, Eraser
Lock, Unlock
Sparkles for AI action only
Wand2 for generate/variation
Music2 for motif
Piano for piano roll
SlidersHorizontal for inspector/settings
Clock3 for jobs/history
Check, X, AlertTriangle
ChevronDown, ChevronRight
PanelLeft, PanelRight, PanelBottom
```

Do not hand-draw SVG icons unless no Lucide icon exists and the icon is domain-specific.

## 5. Layout

Main shell:

```text
Top bar: 48px
Left rail: 260px default, 220-340px resizable
Right inspector: 320px default, 280-420px resizable
Bottom panel: 220px default, 160-360px resizable
Center editor: remaining space
```

Canvas surfaces:

- Timeline: fixed minimum height 140px.
- Piano roll: fills editor tab, minimum height 360px.
- Transport is always visible.
- Inspector never overlays timeline/piano-roll.
- Bottom panel can collapse.

Use `react-resizable-panels` or an equivalent lightweight panel primitive for the shell. Do not build resize behavior from scratch.

## 6. Visual Tokens

Use CSS variables and Tailwind tokens. Keep the palette neutral with restrained accents.

```css
:root {
  --bg: 220 12% 9%;
  --panel: 220 11% 12%;
  --panel-2: 220 10% 15%;
  --surface: 220 9% 18%;
  --border: 220 8% 25%;
  --text: 210 20% 92%;
  --muted: 215 10% 64%;
  --faint: 215 8% 42%;
  --accent: 188 78% 52%;
  --accent-2: 42 92% 58%;
  --selection: 212 92% 58%;
  --success: 142 60% 45%;
  --warning: 38 92% 55%;
  --danger: 0 72% 58%;
}
```

Radius:

```text
controls: 6px
panels: 0-6px
cards/items: 6px
modals: 8px max
```

Typography:

```text
font: Inter or system UI
body: 13px
compact labels: 12px
panel headings: 12px, uppercase optional
editor values: 13px tabular-nums
do not scale font with viewport width
letter spacing: 0
```

## 7. Interaction Rules

Selection:

- Selection is always visible in timeline and inspector.
- Selected bars show both range and exact bar numbers.
- Selected notes show pitch, start beat, duration, velocity in inspector.

Locks:

- Lock states must be visible in both section block and inspector.
- AI prompts must include active locks.
- Applying a patch that violates locks is rejected.

Diff preview:

- AI proposal creates preview state, not mutation.
- Preview visually marks added/removed/changed notes.
- Apply commits snapshot + patch.
- Reject clears preview.

Undo/redo:

- Every AI apply action must be undoable.
- Undo/redo buttons are disabled when unavailable.
- Keyboard shortcuts can come after MVP UI works.

Jobs:

- Long-running jobs appear in bottom job queue.
- Job rows show status, progress, cancel, error details.
- Job indicators must not cover editor content.

## 8. State Management

Use two kinds of state:

```text
Server/project state:
  TanStack Query

Editor/session state:
  Zustand
```

Do not duplicate full server state in Zustand.

Recommended stores:

```text
useEditorStore
  activeProjectId
  selectedBarRange
  selectedSectionIds
  selectedTrackIds
  selectedNoteIds
  activeEditorTab
  zoom
  scroll
  previewPatchId

useTransportStore
  isPlaying
  playheadBeat
  loopRange
  metronomeEnabled

usePanelStore
  leftCollapsed
  rightCollapsed
  bottomCollapsed
  panelSizes

useAgentUiStore
  activeSessionId
  draftPrompt
  streamVisible
  expandedProposalIds
```

Project mutations:

```text
UI command
  -> schema-validated API call or pure timeline-engine command
  -> project snapshot/patch
  -> query invalidation/update
```

Use Zustand selectors to avoid re-rendering the whole app on playhead or selection changes.

Tone.js playback state must not drive React re-renders every frame. Use refs/requestAnimationFrame for playhead drawing and throttle UI updates.

## 9. Canvas Rules

Use Konva/react-konva for:

- Timeline sections and bar selection.
- Piano roll grid and notes.
- Preview diff overlays.

Performance rules:

- Keep canonical note data outside Konva nodes.
- Use memoized derived render data.
- Batch draw changes where possible.
- Avoid one React component per grid line if it becomes slow.
- Use canvas layers: grid, clips/notes, selection/preview, playhead.
- Throttle drag updates.

Required test ids:

```text
timeline-canvas
piano-roll-canvas
transport-play
transport-stop
agent-prompt
agent-send
patch-apply
patch-reject
export-midi
```

## 10. Accessibility

- Icon-only buttons need `aria-label`.
- Tooltips explain icons.
- Form controls have labels even if visually compact.
- Focus ring is visible.
- Dialogs and menus use Radix focus management.
- Color is not the only indicator for diff state; use symbols/labels in inspector.

## 11. UI Do Not Build

- Custom select/menu/dialog primitives.
- Custom icon set.
- Full theme editor.
- Marketing page.
- Dashboard homepage.
- Complex card grid.
- Nested cards inside cards.
- Decorative orb/gradient backgrounds.
- Full notation editor.
- Mixer/effects rack.
