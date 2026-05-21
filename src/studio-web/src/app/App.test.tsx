import { describe, expect, it } from "vitest";
import { sampleMusicIr } from "@cc-music/music-ir";

describe("studio shell", () => {
  it("starts from the sample project fixture", () => {
    expect(sampleMusicIr.projectId).toBe("demo");
  });
});
