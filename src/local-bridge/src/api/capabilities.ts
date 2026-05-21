import type { FastifyInstance } from "fastify";
import { defaultToolRegistry } from "@cc-music/tool-registry";
import type { BridgeConfig } from "../config";

export async function registerCapabilityRoutes(app: FastifyInstance, config: BridgeConfig) {
  app.get("/api/health", async () => ({
    ok: true,
    service: "cc-music-local-bridge"
  }));

  app.get("/api/system/capabilities", async () => ({
    codex: { available: config.agentAdapter === "codex", mode: "exec" },
    claude: { available: config.agentAdapter === "claude", mode: "print-stream-json" },
    ffmpeg: { available: false },
    basicPitch: { available: false },
    fluidSynth: { available: false },
    aceStep: { available: false },
    tools: defaultToolRegistry
  }));
}
