import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Circle, Text as KonvaText } from "react-konva";
import Konva from "konva";
import { sampleMusicIr } from "@cc-music/music-ir";
import { barRangeLength } from "@cc-music/timeline-engine";
import { useEditorStore } from "../../stores/useEditorStore";
import { testIds } from "../../testids";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const TIMELINE_HEIGHT = 140;
const BAR_WIDTH = 80;
const SECTION_Y = 8;
const SECTION_HEIGHT = 48;
const LABEL_Y = 64;
const LOCK_DOT_RADIUS = 3;

// ---------------------------------------------------------------------------
// Section color palette — derived from app CSS variable hues
// ---------------------------------------------------------------------------

const SECTION_COLORS: Array<{ fill: string; stroke: string }> = [
  { fill: "hsla(188, 78%, 52%, 0.18)", stroke: "hsl(188 78% 52%)" },
  { fill: "hsla(42, 92%, 58%, 0.18)", stroke: "hsl(42 92% 58%)" },
  { fill: "hsla(212, 92%, 58%, 0.18)", stroke: "hsl(212 92% 58%)" },
  { fill: "hsla(142, 60%, 45%, 0.18)", stroke: "hsl(142 60% 45%)" },
];

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function barToX(bar: number): number {
  return (bar - 1) * BAR_WIDTH;
}

function xToBar(x: number, maxBar: number): number {
  const raw = Math.max(1, Math.floor(x / BAR_WIDTH) + 1);
  return Math.min(raw, maxBar);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(800);

  // ---- Store selectors ----
  const selectedBarRange = useEditorStore((s) => s.selectedBarRange);
  const setSelectedBarRange = useEditorStore((s) => s.setSelectedBarRange);
  const previewPatchId = useEditorStore((s) => s.previewPatchId);

  // ---- Derived render data (memoized) ----
  const sections = useMemo(() => sampleMusicIr.sections, []);

  const totalBars = useMemo(() => {
    if (sections.length === 0) return 16;
    return Math.max(...sections.map((s) => s.barRange[1]));
  }, [sections]);

  const totalContentWidth = totalBars * BAR_WIDTH;
  const canvasWidth = Math.max(stageWidth, totalContentWidth);

  // Keep a ref of totalBars so mouse handlers never go stale
  const totalBarsRef = useRef(totalBars);
  totalBarsRef.current = totalBars;

  // ---- Drag selection state (refs avoid stale closure issues) ----
  const dragRef = useRef<{ startBar: number; currentBar: number } | null>(
    null,
  );
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);

  // ---- ResizeObserver: keep the Stage at container width ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setStageWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- Mouse handlers ----

  // Commit the active drag to the store and reset local state.
  const commitDrag = useCallback(() => {
    const current = dragRef.current;
    if (!current) return;
    const start = Math.min(current.startBar, current.currentBar);
    const end = Math.max(current.startBar, current.currentBar);
    setSelectedBarRange([start, end]);
    dragRef.current = null;
    setDragRange(null);
  }, [setSelectedBarRange]);

  // Document-level mouseup ensures we commit even when the pointer
  // is released outside the Konva stage.
  useEffect(() => {
    if (!dragRange) return;
    const handleDocMouseUp = () => {
      commitDrag();
    };
    document.addEventListener("mouseup", handleDocMouseUp);
    return () => document.removeEventListener("mouseup", handleDocMouseUp);
  }, [dragRange, commitDrag]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const bar = xToBar(pos.x, totalBarsRef.current);
    dragRef.current = { startBar: bar, currentBar: bar };
    setDragRange([bar, bar]);
  }, []);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const current = dragRef.current;
    if (!current) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const bar = xToBar(pos.x, totalBarsRef.current);
    dragRef.current = { startBar: current.startBar, currentBar: bar };
    const start = Math.min(current.startBar, bar);
    const end = Math.max(current.startBar, bar);
    setDragRange([start, end]);
  }, []);

  // Visual selection: in-progress drag overrides committed store value
  const visualSelection: [number, number] | null =
    dragRange ?? selectedBarRange;

  // ---- Grid layer: bar lines + bar-number labels ----
  const gridLayer = useMemo(() => {
    const children: React.ReactNode[] = [];
    for (let bar = 1; bar <= totalBars + 1; bar++) {
      const x = barToX(bar);
      children.push(
        <Line
          key={`grid-${bar}`}
          points={[x, 0, x, TIMELINE_HEIGHT]}
          stroke="hsl(220 8% 25%)"
          strokeWidth={bar === 1 ? 1 : 0.5}
          listening={false}
        />,
      );
    }
    for (let bar = 1; bar <= totalBars; bar++) {
      const x = barToX(bar) + 4;
      children.push(
        <KonvaText
          key={`lbl-${bar}`}
          x={x}
          y={LABEL_Y}
          text={String(bar)}
          fontSize={11}
          fontFamily="Inter, ui-sans-serif, sans-serif"
          fill="hsl(215 8% 42%)"
          listening={false}
        />,
      );
    }
    return children;
  }, [totalBars]);

  // Re-do section layer with proper independent nodes
  const sectionNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    sections.forEach((section, idx) => {
      const { barRange, name, style, locks, id } = section;
      const color = SECTION_COLORS[idx % SECTION_COLORS.length]!;
      const x = barToX(barRange[0]);
      const w = barRangeLength(barRange) * BAR_WIDTH;
      const anyLock = Object.values(locks).some(Boolean);

      // Section block
      nodes.push(
        <Rect
          key={`${id}-block`}
          x={x}
          y={SECTION_Y}
          width={w}
          height={SECTION_HEIGHT}
          fill={color.fill}
          stroke={color.stroke}
          strokeWidth={1}
          cornerRadius={3}
          listening={false}
        />,
      );

      // Section name
      nodes.push(
        <KonvaText
          key={`${id}-name`}
          x={x + 6}
          y={SECTION_Y + 7}
          text={name}
          fontSize={13}
          fontFamily="Inter, ui-sans-serif, sans-serif"
          fontStyle="bold"
          fill="hsl(210 20% 92%)"
          listening={false}
        />,
      );

      // Genre label
      nodes.push(
        <KonvaText
          key={`${id}-genre`}
          x={x + 6}
          y={SECTION_Y + 25}
          text={style.genre}
          fontSize={11}
          fontFamily="Inter, ui-sans-serif, sans-serif"
          fill="hsl(215 10% 64%)"
          listening={false}
        />,
      );

      // Lock indicator dot (top-right corner of section)
      if (anyLock) {
        nodes.push(
          <Circle
            key={`${id}-lock`}
            x={x + w - 10}
            y={SECTION_Y + 10}
            radius={LOCK_DOT_RADIUS}
            fill="hsl(38 92% 55%)"
            stroke="hsl(38 92% 55%)"
            strokeWidth={1}
            listening={false}
          />,
        );
      }
    });
    return nodes;
  }, [sections]);

  // ---- Selection layer: highlighted bar-range overlay ----
  const selectionOverlay = useMemo(() => {
    if (!visualSelection) return null;
    const x = barToX(visualSelection[0]);
    const w = barRangeLength(visualSelection) * BAR_WIDTH;
    return (
      <Rect
        x={x}
        y={0}
        width={w}
        height={TIMELINE_HEIGHT}
        fill="hsla(212, 92%, 58%, 0.10)"
        stroke="hsla(212, 92%, 58%, 0.35)"
        strokeWidth={1}
        listening={false}
      />
    );
  }, [visualSelection]);

  // ---- Preview layer: patch-preview overlay ----
  const previewOverlay = useMemo(() => {
    if (!previewPatchId) return null;
    // Dashed warning-tint overlay over the whole timeline
    return (
      <Rect
        x={0}
        y={0}
        width={totalContentWidth}
        height={TIMELINE_HEIGHT}
        fill="hsla(38, 92%, 55%, 0.06)"
        stroke="hsla(38, 92%, 55%, 0.30)"
        strokeWidth={1}
        dash={[8, 4]}
        listening={false}
      />
    );
  }, [previewPatchId, totalContentWidth]);

  // ---- Rendering ----
  return (
    <div
      ref={containerRef}
      data-testid={testIds.timelineCanvas}
      className="flex flex-1 overflow-hidden"
    >
      <Stage width={canvasWidth} height={TIMELINE_HEIGHT}>
        {/* Layer 1 — Grid */}
        <Layer listening={false}>{gridLayer}</Layer>

        {/* Layer 2 — Sections */}
        <Layer listening={false}>{sectionNodes}</Layer>

        {/* Layer 3 — Selection overlay */}
        <Layer listening={false}>{selectionOverlay}</Layer>

        {/* Layer 4 — Preview overlay */}
        <Layer listening={false}>{previewOverlay}</Layer>

        {/* Layer 5 — Interaction surface (transparent, captures drag) */}
        <Layer>
          <Rect
            x={0}
            y={0}
            width={totalContentWidth}
            height={TIMELINE_HEIGHT}
            fill="transparent"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          />
        </Layer>
      </Stage>
    </div>
  );
}
