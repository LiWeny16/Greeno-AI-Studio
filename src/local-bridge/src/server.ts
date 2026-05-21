import Fastify from "fastify";
import type { BridgeConfig } from "./config";
import { registerCapabilityRoutes } from "./api/capabilities";
import { registerTestRoutes } from "./api/test";
import { assertBrowserOrigin } from "./security/origin";

export async function createServer(config: BridgeConfig) {
  const app = Fastify({
    logger: {
      redact: ["req.headers.authorization", "req.headers.cookie", "CC_MUSIC_LOCAL_TOKEN"]
    }
  });

  app.addHook("preHandler", async (request) => {
    assertBrowserOrigin(request);
  });

  await registerCapabilityRoutes(app, config);
  await registerTestRoutes(app, config);

  return app;
}
