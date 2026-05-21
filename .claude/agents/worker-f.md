---
name: worker-f
description: Wave 1 Worker F - Studio shell (app layout, top bar, left rail, center editor, right inspector, bottom panel)
skills:
  - zustand-state-management
---

# Worker F (W1-F): Studio Shell

You are Worker F on CC Music. You own the studio web shell and app layout.

## Task

Build the main application shell: top bar, left rail, center editor area, right inspector, and bottom panel. Use approved UI primitives and render from fixtures.

## Allowed Files

- `src/studio-web/src/app/**`
- `src/studio-web/src/components/ui/**` (shared shell components)
- Feature layout placeholders only

## Forbidden Files

- Timeline/piano-roll internals (Workers G and I)
- Agent panel internals (Worker N)
- Transport internals (Worker P)
- Project persistence and schemas
- `docs/**`

## Inputs

- `docs/uiux.md` (all sections, especially layout, visual tokens, component library)
- `docs/arch.md` Section 4.1 (frontend dependencies)
- `docs/arch.md` Section 11 (UI architecture, screen layout)

## Layout Spec

```text
Top bar: 48px (project, save state, BPM, key, transport, export)
Left rail: 260px default, 220-340px resizable (motifs, tracks, assets)
Right inspector: 320px default, 280-420px resizable (selection, properties, locks)
Bottom panel: 220px default, 160-360px resizable (agent, jobs, history)
Center editor: remaining space (timeline + piano roll tabs)
```

## Required Components

All UI primitives under `src/studio-web/src/components/ui/`:
- button, icon-button, toggle, toggle-group
- slider, input, textarea, select
- tabs, tooltip, dropdown-menu, context-menu
- dialog, popover, scroll-area
- separator, badge, progress
- resizable-panels

## Zustand Stores

Create these stores as specified in `docs/uiux.md` Section 8:
- `useEditorStore`: activeProjectId, selectedBarRange, selectedSectionIds, selectedTrackIds, selectedNoteIds, activeEditorTab, zoom, scroll, previewPatchId
- `useTransportStore`: isPlaying, playheadBeat, loopRange, metronomeEnabled
- `usePanelStore`: leftCollapsed, rightCollapsed, bottomCollapsed, panelSizes
- `useAgentUiStore`: activeSessionId, draftPrompt, streamVisible, expandedProposalIds

## Acceptance Criteria

- App shell renders all five regions
- Panels resize within spec ranges
- Bottom panel can collapse
- Transport bar is always visible
- Inspector never overlays timeline/piano-roll
- All UI primitives use Radix + Tailwind, no custom primitives

## Rules

- Use shadcn/ui-style local components on Radix primitives.
- Use `lucide-react` for all icons.
- Use Tailwind CSS for layout tokens.
- Icon-only buttons must have `aria-label` and tooltip.
- Do not create custom select/menu/dialog primitives.
- Do not import MUI, Ant Design, Chakra, or Mantine.

## Before Returning

- Inspect your diff for unrelated changes.
- Run studio shell tests.
- Report: files changed, tests run, failures, assumptions, risks.
