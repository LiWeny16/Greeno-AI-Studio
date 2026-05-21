import { describe, expect, it } from "vitest";
import process from "node:process";
import { createServer } from "./server";
import type { BridgeConfig } from "./config";

const config: BridgeConfig = {
  agentAdapter: "mock",
  host: "127.0.0.1",
  port: 8787,
  projectRoot: ".tmp/cc-music-test",
  testMode: true,
  workers: "mock",
  pythonWorker: {
    enabled: false,
    pythonPath: process.cwd(),
    requestTimeoutMs: 30000,
  },
};

describe("MIDI import/export routes", () => {
  it("POST import/midi returns valid IR shape (200)", async () => {
    const app = await createServer(config);

    // Create a project first
    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Test Import", tempo: 120, key: "C major", timeSignature: "4/4" },
    });
    expect(createRes.statusCode).toBe(200);
    const { manifest } = createRes.json();
    const projectId = manifest.projectId;

    // Import MIDI
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/import/midi`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("ir");
    expect(body.ir.schemaVersion).toBe(1);
    expect(body.ir.projectId).toBe(projectId);
    expect(body.ir.tracks.length).toBeGreaterThan(0);
    expect(body.ir.motifs.length).toBeGreaterThan(0);
    expect(body.ir.sections.length).toBeGreaterThan(0);
    // Verify source type is imported_midi
    expect(body.ir.motifs[0].source.type).toBe("imported_midi");
  });

  it("POST import/midi with invalid project returns 404", async () => {
    const app = await createServer(config);

    const res = await app.inject({
      method: "POST",
      url: "/api/projects/nonexistent/import/midi",
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET export/midi returns octet-stream (200)", async () => {
    const app = await createServer(config);

    // Create a project first
    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Test Export", tempo: 120, key: "C major", timeSignature: "4/4" },
    });
    expect(createRes.statusCode).toBe(200);
    const { manifest } = createRes.json();
    const projectId = manifest.projectId;

    // Export MIDI
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/export/midi`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toContain(`${projectId}.mid`);
    expect(Buffer.isBuffer(res.rawPayload)).toBe(true);
  });

  it("GET export/midi with invalid project returns 404", async () => {
    const app = await createServer(config);

    const res = await app.inject({
      method: "GET",
      url: "/api/projects/nonexistent/export/midi",
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET export/midi returns valid MIDI file header bytes", async () => {
    const app = await createServer(config);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Test MIDI Bytes", tempo: 120, key: "C major", timeSignature: "4/4" },
    });
    expect(createRes.statusCode).toBe(200);
    const { manifest } = createRes.json();
    const projectId = manifest.projectId;

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/export/midi`,
    });
    expect(res.statusCode).toBe(200);

    const buf = res.rawPayload;
    // "MThd" magic bytes
    expect(buf.slice(0, 4).toString()).toBe("MThd");
    // "MTrk" should appear after the header chunk
    const mtrkIndex = buf.indexOf("MTrk");
    expect(mtrkIndex).toBeGreaterThan(10);
  });
});
