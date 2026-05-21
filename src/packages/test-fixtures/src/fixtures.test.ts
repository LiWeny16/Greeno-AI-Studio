import { describe, expect, it } from "vitest";
import { defaultToolRegistry, sampleMusicIr } from "./index";

describe("shared test fixtures", () => {
  it("exports project and registry fixtures", () => {
    expect(sampleMusicIr.projectId).toBe("demo");
    expect(defaultToolRegistry.length).toBeGreaterThan(0);
  });
});
