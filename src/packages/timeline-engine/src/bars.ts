import type { BarRange } from "@cc-music/music-ir";

export function barToStartBeat(bar: number, beatsPerBar = 4): number {
  assertPositiveInteger(bar, "bar");
  assertPositiveInteger(beatsPerBar, "beatsPerBar");
  return (bar - 1) * beatsPerBar;
}

export function beatToBar(beat: number, beatsPerBar = 4): number {
  if (!Number.isFinite(beat) || beat < 0) {
    throw new Error("beat must be a nonnegative finite number");
  }
  assertPositiveInteger(beatsPerBar, "beatsPerBar");
  return Math.floor(beat / beatsPerBar) + 1;
}

export function barRangeToBeatRange([startBar, endBar]: BarRange, beatsPerBar = 4): [number, number] {
  assertPositiveInteger(beatsPerBar, "beatsPerBar");
  return [barToStartBeat(startBar, beatsPerBar), endBar * beatsPerBar];
}

export function barRangeLength([startBar, endBar]: BarRange): number {
  return endBar - startBar + 1;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}
