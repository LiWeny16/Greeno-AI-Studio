import { describe, expect, it, beforeAll } from "vitest";
import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "./server";
import type { BridgeConfig } from "./config";

const TEST_ROOT = path.resolve(".tmp/cc-music-bridge-test");

const config: BridgeConfig = {
  agentAdapter: "mock",
  host: "127.0.0.1",
  port: 8787,
  projectRoot: TEST_ROOT,
  testMode: true,
  workers: "mock",
};

let app: Awaited<ReturnType<typeof createServer>>;

beforeAll(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
  await mkdir(TEST_ROOT, { recursive: true });
  app = await createServer(config);
});

describe("project routes", () => {
  let projectId: string;

  it("POST /api/projects creates a project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Test Project", tempo: 128, key: "D minor", timeSignature: "3/4" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.manifest.title).toBe("Test Project");
    expect(body.manifest.schemaVersion).toBe(1);
    expect(body.ir.tempo).toBe(128);
    expect(body.ir.key).toBe("D minor");
    expect(body.ir.timeSignature).toBe("3/4");
    expect(body.manifest.projectId).toBeTruthy();
    projectId = body.manifest.projectId;
  });

  it("POST /api/projects uses defaults", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Default Project" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ir.tempo).toBe(120);
    expect(body.ir.key).toBe("C major");
    expect(body.ir.timeSignature).toBe("4/4");
  });

  it("POST /api/projects rejects missing title", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { tempo: 120 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/projects rejects invalid tempo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Bad", tempo: 500 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/projects lists projects", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.projects)).toBe(true);
    expect(body.projects.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/projects/:projectId returns project", async () => {
    const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.manifest.projectId).toBe(projectId);
    expect(body.ir.title).toBe("Test Project");
  });

  it("GET /api/projects/:projectId returns 404 for missing project", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects/nonexistent" });
    expect(res.statusCode).toBe(404);
  });

  it("PUT /api/projects/:projectId/ir updates the IR", async () => {
    const { ir } = (
      await app.inject({ method: "GET", url: `/api/projects/${projectId}` })
    ).json();

    ir.title = "Updated Title";
    ir.tempo = 140;

    const res = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/ir`,
      payload: ir,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ir.title).toBe("Updated Title");
    expect(body.ir.tempo).toBe(140);
  });

  it("PUT /api/projects/:projectId/ir rejects mismatched projectId", async () => {
    const { ir } = (
      await app.inject({ method: "GET", url: `/api/projects/${projectId}` })
    ).json();

    ir.projectId = "wrong-id";

    const res = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/ir`,
      payload: ir,
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT /api/projects/:projectId/ir rejects invalid IR", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/ir`,
      payload: { not: "valid ir" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("snapshot routes", () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Snapshot Test" },
    });
    projectId = res.json().manifest.projectId;
  });

  it("POST /api/projects/:projectId/snapshots creates a snapshot", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/snapshots`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.snapshotId).toMatch(/^snap_\d{6}\.json$/);
    expect(body.ir.projectId).toBe(projectId);
  });

  it("creates monotonically increasing snapshot files", async () => {
    const res1 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/snapshots`,
    });
    const res2 = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/snapshots`,
    });
    // first test in this block already created snap_000001
    expect(res1.json().snapshotId).toBe("snap_000002.json");
    expect(res2.json().snapshotId).toBe("snap_000003.json");
  });

  it("GET /api/projects/:projectId/snapshots lists snapshots", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/snapshots`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.snapshots.length).toBeGreaterThanOrEqual(2);
    expect(body.snapshots).toContain("snap_000001.json");
  });

  it("GET /api/projects/:projectId/snapshots returns empty for missing project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/nonexistent/snapshots",
    });
    // Missing project still returns 200 with empty list (directory does not exist)
    expect(res.statusCode).toBe(200);
    expect(res.json().snapshots).toEqual([]);
  });
});

describe("event routes", () => {
  it("GET /api/projects/:projectId/events returns events", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Event Test" },
    });
    const projectId = createRes.json().manifest.projectId;

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/events`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThanOrEqual(1);
    expect(body.events[0].type).toBe("project_created");
    expect(body.events[0].projectId).toBe(projectId);
  });

  it("events.ndjson records patch_applied events", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Patch Event Test" },
    });
    const projectId = createRes.json().manifest.projectId;

    // Apply a patch
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/patches/apply`,
      payload: {
        summary: "Test patch",
        patch: [
          { op: "replace", path: "/title", value: "Patched Title" },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/events`,
    });
    const events = res.json().events;
    const patchEvent = events.find((e: { type: string }) => e.type === "patch_applied");
    expect(patchEvent).toBeTruthy();
    expect(patchEvent.payload.snapshotId).toBeTruthy();
    expect(patchEvent.payload.patchId).toBeTruthy();
  });
});

describe("patch routes", () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Patch Test Project" },
    });
    projectId = res.json().manifest.projectId;
  });

  it("POST /api/projects/:projectId/patches/preview shows a preview", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/patches/preview`,
      payload: {
        summary: "Change the title and tempo",
        patch: [
          { op: "replace", path: "/title", value: "Previewed Title" },
          { op: "replace", path: "/tempo", value: 100 },
        ],
        musicalDiff: {
          barsChanged: [1, 8],
          notesAdded: 4,
          notesRemoved: 2,
          preservedMotifs: ["motif_main"],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.proposal.summary).toBe("Change the title and tempo");
    expect(body.proposal.proposalId).toMatch(/^patch_/);
    expect(body.previewIr.title).toBe("Previewed Title");
    expect(body.previewIr.tempo).toBe(100);
    // Original should not be changed (preview only)
    const getRes = await app.inject({ method: "GET", url: `/api/projects/${projectId}` });
    expect(getRes.json().ir.title).toBe("Patch Test Project");
  });

  it("POST /api/projects/:projectId/patches/apply applies a patch", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/patches/apply`,
      payload: {
        summary: "Replace genre",
        patch: [
          { op: "add", path: "/sections", value: [] },
          { op: "add", path: "/motifs", value: [] },
          { op: "add", path: "/tracks", value: [] },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.snapshotId).toMatch(/^snap_\d{6}\.json$/);
    expect(body.proposalId).toMatch(/^patch_/);
    expect(body.ir.sections).toEqual([]);
  });

  it("POST /api/projects/:projectId/patches/apply creates a snapshot before mutating", async () => {
    const snapRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/snapshots`,
    });
    // Should have at least one snapshot from the apply above
    expect(snapRes.json().snapshots.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/projects/:projectId/patches/preview validates patch result", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/patches/preview`,
      payload: {
        summary: "Invalid patch",
        patch: [
          { op: "replace", path: "/schemaVersion", value: 99 },
        ],
      },
    });
    // schemaVersion must be literal 1, validation throws ZodError -> 400
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/projects/:projectId/patches/preview rejects missing summary", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/patches/preview`,
      payload: {
        patch: [{ op: "replace", path: "/title", value: "x" }],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("job routes", () => {
  it("GET /api/projects/:projectId/jobs/:jobId returns 404 for missing job", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/some-project/jobs/missing-job",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("crash recovery", () => {
  it("recovers project from latest valid snapshot when project.json is missing", async () => {
    // Create a project and take a snapshot
    const createRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Recovery Test", tempo: 90, key: "E minor" },
    });
    const projectId = createRes.json().manifest.projectId;

    // Update IR and take snapshot
    const { ir } = createRes.json();
    ir.tempo = 110;
    await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/ir`,
      payload: ir,
    });

    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/snapshots`,
    });

    // Corrupt project.json by deleting it
    const { unlink } = await import("node:fs/promises");
    const projectJsonPath = path.join(TEST_ROOT, "projects", projectId, "project.json");
    await unlink(projectJsonPath);

    // Loading should recover from snapshot
    const loadRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}`,
    });
    expect(loadRes.statusCode).toBe(200);
    // The recovered IR should have the snapshot state (tempo: 110)
    expect(loadRes.json().ir.tempo).toBe(110);
  });
});
