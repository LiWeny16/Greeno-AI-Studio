import type { BarRange } from "@cc-music/music-ir";
export declare function barToStartBeat(bar: number, beatsPerBar?: number): number;
export declare function beatToBar(beat: number, beatsPerBar?: number): number;
export declare function barRangeToBeatRange([startBar, endBar]: BarRange, beatsPerBar?: number): [number, number];
export declare function barRangeLength([startBar, endBar]: BarRange): number;
//# sourceMappingURL=bars.d.ts.map