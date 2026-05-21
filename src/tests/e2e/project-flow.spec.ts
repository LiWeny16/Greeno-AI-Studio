import { expect, test } from "@playwright/test";
import {
  apiApplyPatch,
  apiCreateProject,
  apiGetProject,
  apiListProjects,
  apiPreviewPatch,
  apiUpdateProjectIr,
  resetTestState,
  seedTestProject,
} from "./helpers";

test.describe("project flow", () => {
  test("create project via bridge and verify it appears in list", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const created = await apiCreateProject(page, {
      title: "E2E Flow Project",
      tempo: 128,
      key: "E minor",
      timeSignature: "4/4",
    });

    expect(created.manifest.projectId).toBeTruthy();
    expect(created.manifest.title).toBe("E2E Flow Project");
    expect(created.ir.tempo).toBe(128);
    expect(created.ir.key).toBe("E minor");

    // Verify project appears in list
    const list = await apiListProjects(page);
    const found = list.projects.some(
      (p) => p.projectId === created.manifest.projectId,
    );
    expect(found).toBe(true);
  });

  test("update BPM, key, and time signature — changes persist", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Create initial project
    const created = await apiCreateProject(page, {
      title: "Update Test",
      tempo: 100,
      key: "C major",
      timeSignature: "4/4",
    });
    const projectId = created.manifest.projectId;

    // Fetch current IR so we can mutate and PUT the whole object
    const { ir } = await apiGetProject(page, projectId);
    const updatedIr = {
      ...ir,
      tempo: 160,
      key: "G minor",
      timeSignature: "6/8",
    };

    await apiUpdateProjectIr(page, projectId, updatedIr);

    // Re-fetch and verify changes persisted
    const reloaded = await apiGetProject(page, projectId);
    expect(reloaded.ir.tempo).toBe(160);
    expect(reloaded.ir.key).toBe("G minor");
    expect(reloaded.ir.timeSignature).toBe("6/8");
  });

  test("patch preview returns a valid proposal with preview IR", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const { manifest, project } = await seedTestProject(page);
    const projectId = manifest.projectId;

    const result = await apiPreviewPatch(page, projectId, {
      summary: "Test: change genre",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "test genre",
        },
      ],
    });

    expect(result.proposal.proposalId).toBeTruthy();
    expect(result.proposal.summary).toBe("Test: change genre");

    // previewIr should reflect the changed genre
    const sections = result.previewIr.sections as Array<{
      style: { genre: string };
    }>;
    expect(sections[0]?.style.genre).toBe("test genre");
  });

  test("patch apply creates a snapshot and mutates project IR", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const { manifest } = await seedTestProject(page);
    const projectId = manifest.projectId;

    // Verify original genre
    const before = await apiGetProject(page, projectId);
    const sectionsBefore = before.ir.sections as Array<{
      style: { genre: string };
    }>;
    expect(sectionsBefore[0]?.style.genre).toBe("minimal piano");

    // Apply a genre-changing patch
    const applied = await apiApplyPatch(page, projectId, {
      summary: "Apply: change genre to dark ambient",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "dark ambient",
        },
      ],
    });

    expect(applied.snapshotId).toBeTruthy();
    expect(applied.proposalId).toBeTruthy();

    // Verify mutation persisted
    const after = await apiGetProject(page, projectId);
    const sectionsAfter = after.ir.sections as Array<{
      style: { genre: string };
    }>;
    expect(sectionsAfter[0]?.style.genre).toBe("dark ambient");
  });

  test("schema-invalid patch is rejected by the bridge", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    const { manifest } = await seedTestProject(page);
    const projectId = manifest.projectId;

    // Attempt to replace sections with a non-array value — should fail schema validation
    let failed = false;
    try {
      await apiPreviewPatch(page, projectId, {
        summary: "Invalid patch test",
        patch: [
          {
            op: "replace",
            path: "/sections",
            value: "not-an-array",
          },
        ],
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
