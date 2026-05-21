import { describe, expect, it } from "vitest";
import { MusicIrSchema, ProjectEventSchema, ProjectManifestSchema } from "./schema";
import { sampleManifest, sampleMusicIr, sampleProjectEvent } from "./fixtures";

describe("music-ir schemas", () => {
  it("accepts the sample Music IR", () => {
    expect(MusicIrSchema.parse(sampleMusicIr).projectId).toBe("demo");
  });

  it("accepts the sample manifest", () => {
    expect(ProjectManifestSchema.parse(sampleManifest).schemaVersion).toBe(1);
  });

  it("accepts the sample project event", () => {
    expect(ProjectEventSchema.parse(sampleProjectEvent).type).toBe("project_created");
  });
});
