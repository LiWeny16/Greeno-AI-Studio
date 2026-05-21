import { expect, type Page } from "@playwright/test";

/**
 * Verify that a canvas area element (or placeholder) is not blank.
 *
 * Layer 1 (DOM): verifies the element identified by `testId` is visible
 * and has non-zero CSS dimensions.
 *
 * Layer 2 (Pixel): if the element contains an HTMLCanvasElement child,
 * samples a grid of pixels to confirm at least one is non-transparent.
 */
export async function expectCanvasNotBlank(
  page: Page,
  testId: string,
): Promise<void> {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`[data-testid="${testId}"] has no bounding box`);
  }
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);

  // Pixel-level check only if a real <canvas> child exists
  const canvasCount = await locator.locator("canvas").count();
  if (canvasCount > 0) {
    const hasContent = await page.evaluate((selector) => {
      const container = document.querySelector(
        `[data-testid="${selector}"]`,
      );
      const canvas = container?.querySelector(
        "canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      // Sample a grid across the canvas
      const stepX = Math.max(1, Math.floor(canvas.width / 4));
      const stepY = Math.max(1, Math.floor(canvas.height / 4));
      for (let y = 0; y < canvas.height; y += stepY) {
        for (let x = 0; x < canvas.width; x += stepX) {
          const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
          if ((r! + g! + b!) > 0 && a! > 0) return true;
        }
      }
      return false;
    }, testId);
    expect(
      hasContent,
      `Canvas [data-testid="${testId}"] appears blank (no visible pixels)`,
    ).toBe(true);
  }
}

/**
 * Seed a test project via the bridge's test-only API.
 *
 * This exercises the real bridge code path: Vite proxies /api/* to the bridge,
 * and the bridge runs with CC_MUSIC_TEST_MODE=mocked.
 */
export async function seedTestProject(page: Page): Promise<{
  manifest: { projectId: string; title: string };
  project: Record<string, unknown>;
}> {
  const result = await page.evaluate(async () => {
    const res = await fetch("/api/test/seed-project", { method: "POST" });
    if (!res.ok) {
      throw new Error(
        `seed-project failed: ${res.status} ${await res.text()}`,
      );
    }
    return res.json();
  });
  return result as {
    manifest: { projectId: string; title: string };
    project: Record<string, unknown>;
  };
}

/**
 * Reset test state via the bridge's test-only API.
 */
export async function resetTestState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const res = await fetch("/api/test/reset", { method: "POST" });
    if (!res.ok) {
      throw new Error(`reset failed: ${res.status} ${await res.text()}`);
    }
  });
}

/**
 * Bridge API helpers — call these from page.evaluate to exercise real backend
 * code paths through the Vite proxy.
 */

export interface CreateProjectBody {
  title: string;
  tempo?: number;
  key?: string;
  timeSignature?: string;
}

export interface CreateProjectResult {
  manifest: { projectId: string; title: string };
  ir: Record<string, unknown>;
}

/**
 * Create a project via POST /api/projects (through Vite proxy -> bridge).
 */
export async function apiCreateProject(
  page: Page,
  body: CreateProjectBody,
): Promise<CreateProjectResult> {
  return page.evaluate(async (b) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
    if (!res.ok) {
      throw new Error(
        `POST /api/projects failed: ${res.status} ${await res.text()}`,
      );
    }
    return res.json();
  }, body) as Promise<CreateProjectResult>;
}

/**
 * List projects via GET /api/projects.
 */
export async function apiListProjects(
  page: Page,
): Promise<{ projects: Array<{ projectId: string }> }> {
  return page.evaluate(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) {
      throw new Error(
        `GET /api/projects failed: ${res.status} ${await res.text()}`,
      );
    }
    return res.json();
  }) as Promise<{ projects: Array<{ projectId: string }> }>;
}

/**
 * Get a project by ID via GET /api/projects/:projectId.
 */
export async function apiGetProject(
  page: Page,
  projectId: string,
): Promise<{ manifest: Record<string, unknown>; ir: Record<string, unknown> }> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) {
      throw new Error(
        `GET /api/projects/${id} failed: ${res.status} ${await res.text()}`,
      );
    }
    return res.json();
  }, projectId) as Promise<{
    manifest: Record<string, unknown>;
    ir: Record<string, unknown>;
  }>;
}

/**
 * Update project IR via PUT /api/projects/:projectId/ir.
 */
export async function apiUpdateProjectIr(
  page: Page,
  projectId: string,
  ir: Record<string, unknown>,
): Promise<{ ir: Record<string, unknown> }> {
  return page.evaluate(
    async ({ id, body }) => {
      const res = await fetch(`/api/projects/${id}/ir`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          `PUT /api/projects/${id}/ir failed: ${res.status} ${await res.text()}`,
        );
      }
      return res.json();
    },
    { id: projectId, body: ir },
  ) as Promise<{ ir: Record<string, unknown> }>;
}

/**
 * Preview a patch via POST /api/projects/:projectId/patches/preview.
 */
export async function apiPreviewPatch(
  page: Page,
  projectId: string,
  patchBody: {
    summary: string;
    patch: Array<{ op: string; path: string; value?: unknown }>;
    musicalDiff?: Record<string, unknown>;
  },
): Promise<{
  proposal: { proposalId: string; summary: string };
  previewIr: Record<string, unknown>;
}> {
  return page.evaluate(
    async ({ id, body }) => {
      const res = await fetch(`/api/projects/${id}/patches/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Preview failed: ${res.status} ${text}`);
      }
      return res.json();
    },
    { id: projectId, body: patchBody },
  ) as Promise<{
    proposal: { proposalId: string; summary: string };
    previewIr: Record<string, unknown>;
  }>;
}

/**
 * Apply a patch via POST /api/projects/:projectId/patches/apply.
 */
export async function apiApplyPatch(
  page: Page,
  projectId: string,
  patchBody: {
    summary: string;
    patch: Array<{ op: string; path: string; value?: unknown }>;
    musicalDiff?: Record<string, unknown>;
  },
): Promise<{
  ir: Record<string, unknown>;
  snapshotId: string;
  proposalId: string;
}> {
  return page.evaluate(
    async ({ id, body }) => {
      const res = await fetch(`/api/projects/${id}/patches/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apply failed: ${res.status} ${text}`);
      }
      return res.json();
    },
    { id: projectId, body: patchBody },
  ) as Promise<{
    ir: Record<string, unknown>;
    snapshotId: string;
    proposalId: string;
  }>;
}
