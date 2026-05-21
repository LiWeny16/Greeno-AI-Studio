import type { BarRange } from "@cc-music/music-ir";
export declare function normalizeBarRange(a: number, b: number): BarRange;
export declare function isBarInRange(bar: number, [start, end]: BarRange): boolean;
export declare function clampBarRange([start, end]: BarRange, projectBarCount: number): BarRange;
//# sourceMappingURL=selection.d.ts.map