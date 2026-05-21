import { describe, expect, it } from "vitest";
import { barRangeLength, barRangeToBeatRange, barToStartBeat, beatToBar } from "./bars";
import { normalizeBarRange } from "./selection";

describe("timeline bars", () => {
  it("converts bars and beats", () => {
    expect(barToStartBeat(1)).toBe(0);
    expect(barToStartBeat(9)).toBe(32);
    expect(beatToBar(32)).toBe(9);
  });

  it("normalizes selected bar ranges", () => {
    expect(normalizeBarRange(16, 9)).toEqual([9, 16]);
    expect(barRangeLength([9, 16])).toBe(8);
    expect(barRangeToBeatRange([9, 16])).toEqual([32, 64]);
  });
});
