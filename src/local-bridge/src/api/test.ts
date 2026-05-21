import type { FastifyInstance } from "fastify";
import { sampleManifest, sampleMusicIr } from "@cc-music/music-ir";
import type { BridgeConfig } from "../config";

export async function registerTestRoutes(app: FastifyInstance, config: BridgeConfig) {
  if (!config.testMode) {
    return;
  }

  if (!isTempPath(config.projectRoot)) {
    throw new Error("Test mode requires CC_MUSIC_PROJECT_ROOT to be a temp path");
  }

  app.post("/api/test/reset", async () => ({
    ok: true,
    projectRoot: config.projectRoot
  }));

  app.post("/api/test/seed-project", async () => ({
    manifest: sampleManifest,
    project: sampleMusicIr
  }));
}

function isTempPath(projectRoot: string): boolean {
  const normalized = projectRoot.replaceAll("\\", "/").toLowerCase();
  return normalized.includes("/tmp/") || normalized.includes("/temp/") || normalized.includes(".tmp/");
}
