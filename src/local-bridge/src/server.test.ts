import { describe, expect, it } from "vitest";
import { createServer } from "./server";
import type { BridgeConfig } from "./config";

const config: BridgeConfig = {
  agentAdapter: "mock",
  host: "127.0.0.1",
  port: 8787,
  projectRoot: ".tmp/cc-music-test",
  testMode: true,
  workers: "mock"
};

describe("local bridge", () => {
  it("reports health", async () => {
    const app = await createServer(config);
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true });
  });

  it("exposes mock capabilities", async () => {
    const app = await createServer(config);
    const response = await app.inject({ method: "GET", url: "/api/system/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json().tools[0].id).toBe("mock-agent");
  });
});
