import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { BridgeConfig } from "./config";
import { registerCapabilityRoutes } from "./api/capabilities";
import { registerTestRoutes } from "./api/test";
import { registerProjectRoutes } from "./api/projects";
import { registerPatchRoutes } from "./api/patches";
import { registerJobRoutes } from "./api/jobs";
import { registerMidiRoutes } from "./api/midi";
import { assertBrowserOrigin } from "./security/origin";

export async function createServer(config: BridgeConfig) {
  const app = Fastify({
    logger: {
      redact: ["req.headers.authorization", "req.headers.cookie", "CC_MUSIC_LOCAL_TOKEN"]
    }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook("preHandler", async (request) => {
    assertBrowserOrigin(request);
  });

  await registerCapabilityRoutes(app, config);
  await registerTestRoutes(app, config);
  await registerProjectRoutes(app, config);
  await registerPatchRoutes(app, config);
  await registerJobRoutes(app, config);
  await registerMidiRoutes(app, config);

  return app;
}
