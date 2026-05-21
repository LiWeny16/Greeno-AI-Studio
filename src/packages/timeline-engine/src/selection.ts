import type { BarRange } from "@cc-music/music-ir";

export function normalizeBarRange(a: number, b: number): BarRange {
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0) {
    throw new Error("bar range values must be positive integers");
  }
  return [start, end];
}

export function isBarInRange(bar: number, [start, end]: BarRange): boolean {
  return bar >= start && bar <= end;
}

export function clampBarRange([start, end]: BarRange, projectBarCount: number): BarRange {
  if (!Number.isInteger(projectBarCount) || projectBarCount <= 0) {
    throw new Error("projectBarCount must be a positive integer");
  }
  return [Math.max(1, Math.min(start, projectBarCount)), Math.max(1, Math.min(end, projectBarCount))];
}
