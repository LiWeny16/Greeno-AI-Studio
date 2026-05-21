import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text as KonvaText, Line, Group } from "react-konva";
import Konva from "konva";
import { useEditorStore } from "../../stores/useEditorStore";
import { usePianoRollNotes } from "./usePianoRollNotes";
import { testIds } from "../../testids";
import {
  PIANO_ROLL_MIN_HEIGHT,
  BASE_BEAT_WIDTH,
  ROW_HEIGHT,
  MIN_PITCH,
  MAX_PITCH,
  NOTE_CORNER_RADIUS,
  LEFT_MARGIN,
  DEFAULT_DURATION,
  DEFAULT_VELOCITY,
  MIN_DURATION,
  GRID_SNAP,
  RESIZE_HANDLE_WIDTH,
  pitchToMidi,
  midiToPitch,
  isBlackKey,
  pitchToY,
  yToMidi,
  snapToGrid,
} from "./pianoRollHelpers";

// ---------------------------------------------------------------------------
// Derived render data for a single note
// ---------------------------------------------------------------------------

interface NoteRenderData {
  id: string;
  pitch: string;
  midi: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// PianoRoll
// ---------------------------------------------------------------------------

export function PianoRoll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(800);

  // -- Notes via TanStack Query (online) or local fallback (offline) --
  const { notes, _actionsRef, deleteNotes: hookDeleteNotes, isPending } =
    usePianoRollNotes();

  // Stable ref for batch deletes so the keydown listener doesn't churn.
  const deleteNotesRef = useRef(hookDeleteNotes);
  deleteNotesRef.current = hookDeleteNotes;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void isPending; // consumed by future UI feedback

  // -- Store selectors --
  const selectedNoteIds = useEditorStore((s) => s.selectedNoteIds);
  const setSelectedNoteIds = useEditorStore((s) => s.setSelectedNoteIds);
  const zoom = useEditorStore((s) => s.zoom);

  // -- Derived layout --
  const beatWidth = useMemo(() => BASE_BEAT_WIDTH * zoom, [zoom]);
  const totalRows = MAX_PITCH - MIN_PITCH + 1;
  const contentHeight = totalRows * ROW_HEIGHT;

  const maxBeat = useMemo(() => {
    if (notes.length === 0) return 16;
    const max = Math.max(...notes.map((n) => n.startBeat + n.durationBeats));
    return Math.ceil(max) + 4;
  }, [notes]);

  const contentWidth = maxBeat * beatWidth + LEFT_MARGIN;
  const canvasWidth = Math.max(stageWidth, contentWidth);

  // -- Drag state ref --
  const dragRef = useRef<{
    noteId: string;
    kind: "move" | "resize";
    origStartBeat: number;
    origDuration: number;
    origMidi: number;
  } | null>(null);

  // -- ResizeObserver: keep Stage width in sync with container --
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setStageWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // -- Keyboard: Delete / Backspace deletes selected notes --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = document.activeElement?.tagName ?? "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const selected = useEditorStore.getState().selectedNoteIds;
        if (selected.length > 0) {
          deleteNotesRef.current(selected);
          setSelectedNoteIds([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedNoteIds]);

  // =========================================================================
  // Event handlers
  // =========================================================================

  // -- Click on empty space: add note --
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage || e.target !== stage) return;
      const pos = stage.getPointerPosition();
      if (!pos || pos.x < LEFT_MARGIN) return;

      const rawBeat = (pos.x - LEFT_MARGIN) / beatWidth;
      const snappedBeat = snapToGrid(rawBeat, GRID_SNAP);
      const midi = yToMidi(pos.y);
      const pitch = midiToPitch(midi);

      _actionsRef.current.addNote({
        pitch,
        startBeat: Math.max(0, snappedBeat),
        durationBeats: DEFAULT_DURATION,
        velocity: DEFAULT_VELOCITY,
        motifId: "manual",
      });
    },
    [beatWidth],
  );

  // -- Click on note: select --
  const handleNoteClick = useCallback(
    (noteId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      const store = useEditorStore.getState();
      if (e.evt.shiftKey) {
        if (store.selectedNoteIds.includes(noteId)) {
          store.removeSelectedNoteId(noteId);
        } else {
          store.addSelectedNoteId(noteId);
        }
      } else {
        setSelectedNoteIds([noteId]);
      }
    },
    [setSelectedNoteIds],
  );

  // -- Right-click on note: delete --
  const handleNoteContextMenu = useCallback(
    (noteId: string, e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      _actionsRef.current.deleteNote(noteId);
      const store = useEditorStore.getState();
      if (store.selectedNoteIds.includes(noteId)) {
        store.removeSelectedNoteId(noteId);
      }
    },
    [],
  );

  // -- Stage right-click: delete selected --
  const handleStageContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const selected = useEditorStore.getState().selectedNoteIds;
      if (selected.length > 0) {
        _actionsRef.current.deleteNotes(selected);
        setSelectedNoteIds([]);
      }
    },
    [setSelectedNoteIds],
  );

  // -- Note drag start --
  const handleNoteDragStart = useCallback(
    (
      noteId: string,
      startBeat: number,
      midi: number,
      duration: number,
      e: Konva.KonvaEventObject<DragEvent>,
    ) => {
      dragRef.current = {
        noteId,
        kind: "move",
        origStartBeat: startBeat,
        origDuration: duration,
        origMidi: midi,
      };
    },
    [],
  );

  // -- Note drag move --
  const handleNoteDragMove = useCallback(
    (noteId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const drag = dragRef.current;
      if (!drag || drag.noteId !== noteId) return;

      const node = e.target;
      // Snap to grid for visual feedback during drag
      const rawBeat = (node.x() - LEFT_MARGIN) / beatWidth;
      const snappedBeat = snapToGrid(rawBeat, GRID_SNAP);
      const snappedY = Math.round(node.y() / ROW_HEIGHT) * ROW_HEIGHT;

      node.x(LEFT_MARGIN + Math.max(0, snappedBeat) * beatWidth);
      node.y(Math.max(0, Math.min(contentHeight - ROW_HEIGHT, snappedY)));
    },
    [beatWidth, contentHeight],
  );

  // -- Note drag end: commit change --
  const handleNoteDragEnd = useCallback(
    (noteId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const drag = dragRef.current;
      if (!drag || drag.noteId !== noteId) return;

      const node = e.target;
      const newStartBeat = snapToGrid(
        Math.max(0, (node.x() - LEFT_MARGIN) / beatWidth),
        GRID_SNAP,
      );
      const newMidi = yToMidi(node.y());
      const newPitch = midiToPitch(newMidi);

      _actionsRef.current.moveNote(noteId, newPitch, newStartBeat);

      dragRef.current = null;
    },
    [beatWidth],
  );

  // -- Resize handle drag start --
  const handleResizeDragStart = useCallback(
    (
      noteId: string,
      startBeat: number,
      duration: number,
      midi: number,
      e: Konva.KonvaEventObject<DragEvent>,
    ) => {
      e.cancelBubble = true;
      dragRef.current = {
        noteId,
        kind: "resize",
        origStartBeat: startBeat,
        origDuration: duration,
        origMidi: midi,
      };
    },
    [],
  );

  // -- Resize handle drag move --
  const handleResizeDragMove = useCallback(
    (noteId: string, initialHandleX: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const drag = dragRef.current;
      if (!drag || drag.noteId !== noteId) return;

      const node = e.target;
      const rawWidth = (node.x() - initialHandleX) / beatWidth;
      const snappedWidth = snapToGrid(rawWidth, GRID_SNAP);
      node.x(initialHandleX + Math.max(MIN_DURATION, snappedWidth) * beatWidth);
    },
    [beatWidth],
  );

  // -- Resize handle drag end: commit duration --
  const handleResizeDragEnd = useCallback(
    (noteId: string, initialHandleX: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const drag = dragRef.current;
      if (!drag || drag.noteId !== noteId) return;

      const node = e.target;
      const rawDuration = (node.x() - initialHandleX) / beatWidth;
      const newDuration = Math.max(
        MIN_DURATION,
        snapToGrid(rawDuration, GRID_SNAP),
      );

      _actionsRef.current.updateNote(noteId, { durationBeats: newDuration });

      dragRef.current = null;
    },
    [beatWidth],
  );

  // =========================================================================
  // Derived render arrays (memoized)
  // =========================================================================

  const noteRenderData: NoteRenderData[] = useMemo(() => {
    return notes.map((note) => {
      const midi = pitchToMidi(note.pitch);
      const x = LEFT_MARGIN + note.startBeat * beatWidth;
      const y = pitchToY(midi);
      const w = note.durationBeats * beatWidth;
      const h = ROW_HEIGHT;
      return { id: note.id, pitch: note.pitch, midi, startBeat: note.startBeat, durationBeats: note.durationBeats, velocity: note.velocity, x, y, w, h };
    });
  }, [notes, beatWidth]);

  // =========================================================================
  // Grid layer: pitch rows + beat lines + piano key labels
  // =========================================================================

  const gridLayer = useMemo(() => {
    const children: React.ReactNode[] = [];

    // Pitch rows (alternating colors for white/black keys)
    for (let midi = MIN_PITCH; midi <= MAX_PITCH; midi++) {
      const y = pitchToY(midi);
      const black = isBlackKey(midi);
      children.push(
        <Rect
          key={`row-${midi}`}
          x={LEFT_MARGIN}
          y={y}
          width={contentWidth - LEFT_MARGIN}
          height={ROW_HEIGHT}
          fill={black ? "hsla(220, 10%, 10%, 1)" : "hsla(220, 10%, 15%, 1)"}
          stroke="hsla(220, 8%, 22%, 0.5)"
          strokeWidth={0.5}
          listening={false}
          perfectDrawEnabled={false}
        />,
      );
    }

    // Beat lines
    for (let beat = 0; beat <= maxBeat; beat++) {
      const x = LEFT_MARGIN + beat * beatWidth;
      const isBar = beat % 4 === 0;
      children.push(
        <Line
          key={`beat-${beat}`}
          points={[x, 0, x, contentHeight]}
          stroke={isBar ? "hsla(220, 8%, 30%, 0.6)" : "hsla(220, 8%, 22%, 0.3)"}
          strokeWidth={isBar ? 1 : 0.5}
          listening={false}
          perfectDrawEnabled={false}
        />,
      );
    }

    // Beat number labels at top
    for (let beat = 0; beat <= maxBeat; beat += 1) {
      if (beat % 4 === 0) {
        const x = LEFT_MARGIN + beat * beatWidth + 3;
        const bar = Math.floor(beat / 4) + 1;
        children.push(
          <KonvaText
            key={`beat-label-${beat}`}
            x={x}
            y={2}
            text={`${bar}`}
            fontSize={10}
            fontFamily="Inter, ui-sans-serif, sans-serif"
            fill="hsla(215, 8%, 42%, 1)"
            listening={false}
            perfectDrawEnabled={false}
          />,
        );
      }
    }

    // Piano key labels (left margin, white keys only)
    for (let midi = MIN_PITCH; midi <= MAX_PITCH; midi++) {
      const y = pitchToY(midi);
      if (!isBlackKey(midi)) {
        const pitch = midiToPitch(midi);
        children.push(
          <KonvaText
            key={`label-${midi}`}
            x={4}
            y={y + ROW_HEIGHT / 2 - 5}
            text={pitch}
            fontSize={9}
            fontFamily="Inter, ui-sans-serif, sans-serif"
            fill="hsla(215, 10%, 50%, 1)"
            listening={false}
            perfectDrawEnabled={false}
          />,
        );
      }
    }

    // Left margin background
    children.push(
      <Rect
        key="left-margin-bg"
        x={0}
        y={0}
        width={LEFT_MARGIN}
        height={contentHeight}
        fill="hsla(220, 12%, 9%, 1)"
        stroke="hsla(220, 8%, 22%, 0.5)"
        strokeWidth={0.5}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );

    return children;
  }, [contentWidth, contentHeight, maxBeat, beatWidth]);

  // =========================================================================
  // Note layer: draggable note rectangles
  // =========================================================================

  const noteLayer = useMemo(() => {
    return noteRenderData.map((nr) => {
      const isSelected = selectedNoteIds.includes(nr.id);
      // Velocity-based alpha: 0.4 (min) to 1.0 (max)
      const alpha = 0.35 + nr.velocity * 0.65;
      const hue = 188; // accent teal

      const initialHandleX = nr.x + nr.w;

      return (
        <Group key={nr.id}>
          {/* Note rectangle */}
          <Rect
            x={nr.x}
            y={nr.y}
            width={nr.w}
            height={nr.h}
            fill={`hsla(${hue}, 78%, 52%, ${alpha})`}
            stroke={isSelected ? "hsl(42, 92%, 58%)" : `hsla(${hue}, 78%, 35%, 0.5)`}
            strokeWidth={isSelected ? 2 : 1}
            cornerRadius={NOTE_CORNER_RADIUS}
            draggable
            onClick={(e) => handleNoteClick(nr.id, e)}
            onContextMenu={(e) => handleNoteContextMenu(nr.id, e)}
            onDragStart={(e) =>
              handleNoteDragStart(nr.id, nr.startBeat, nr.midi, nr.durationBeats, e)
            }
            onDragMove={(e) => handleNoteDragMove(nr.id, e)}
            onDragEnd={(e) => handleNoteDragEnd(nr.id, e)}
            dragBoundFunc={(pos) => ({
              x: Math.max(LEFT_MARGIN, pos.x),
              y: Math.max(0, Math.min(contentHeight - nr.h, pos.y)),
            })}
            hitStrokeWidth={8}
          />
          {/* Resize handle — only visible when selected */}
          {isSelected && (
            <Rect
              x={initialHandleX}
              y={nr.y}
              width={RESIZE_HANDLE_WIDTH}
              height={nr.h}
              fill="hsla(0, 0%, 100%, 0.85)"
              stroke="hsla(42, 92%, 58%, 1)"
              strokeWidth={1}
              cornerRadius={[0, NOTE_CORNER_RADIUS, NOTE_CORNER_RADIUS, 0]}
              draggable
              onDragStart={(e) =>
                handleResizeDragStart(
                  nr.id,
                  nr.startBeat,
                  nr.durationBeats,
                  nr.midi,
                  e,
                )
              }
              onDragMove={(e) =>
                handleResizeDragMove(nr.id, initialHandleX, e)
              }
              onDragEnd={(e) =>
                handleResizeDragEnd(nr.id, initialHandleX, e)
              }
              dragBoundFunc={(pos) => ({
                x: Math.max(nr.x + MIN_DURATION * beatWidth, pos.x),
                y: nr.y,
              })}
              hitStrokeWidth={10}
            />
          )}
        </Group>
      );
    });
  }, [
    noteRenderData,
    selectedNoteIds,
    beatWidth,
    contentHeight,
    handleNoteClick,
    handleNoteContextMenu,
    handleNoteDragStart,
    handleNoteDragMove,
    handleNoteDragEnd,
    handleResizeDragStart,
    handleResizeDragMove,
    handleResizeDragEnd,
  ]);

  // =========================================================================
  // Selection layer: outline highlights on selected notes
  // =========================================================================

  const selectionLayer = useMemo(() => {
    return selectedNoteIds.map((id) => {
      const nr = noteRenderData.find((r) => r.id === id);
      if (!nr) return null;
      return (
        <Rect
          key={`sel-${id}`}
          x={nr.x - 2}
          y={nr.y - 2}
          width={nr.w + 4}
          height={nr.h + 4}
          fill="transparent"
          stroke="hsl(42, 92%, 58%)"
          strokeWidth={2}
          cornerRadius={NOTE_CORNER_RADIUS + 2}
          listening={false}
          perfectDrawEnabled={false}
        />
      );
    });
  }, [selectedNoteIds, noteRenderData]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      ref={containerRef}
      data-testid={testIds.pianoRollCanvas}
      className="flex flex-1 overflow-hidden"
      style={{ minHeight: PIANO_ROLL_MIN_HEIGHT }}
    >
      <Stage width={canvasWidth} height={contentHeight}>
        {/* Layer 1: Grid (pitch rows, beat lines, labels) */}
        <Layer listening={false}>{gridLayer}</Layer>

        {/* Layer 2: Interaction surface (transparent rect for empty-space clicks) */}
        <Layer>
          <Rect
            x={0}
            y={0}
            width={contentWidth}
            height={contentHeight}
            fill="transparent"
            onClick={handleStageClick}
            onContextMenu={handleStageContextMenu}
          />
        </Layer>

        {/* Layer 3: Notes (draggable) */}
        <Layer>{noteLayer}</Layer>

        {/* Layer 4: Selection highlights (non-interactive) */}
        <Layer listening={false}>{selectionLayer}</Layer>
      </Stage>
    </div>
  );
}
