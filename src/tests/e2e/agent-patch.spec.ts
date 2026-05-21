import { expect, test } from "@playwright/test";
import {
  apiApplyPatch,
  apiGetProject,
  apiPreviewPatch,
  createAndSeedProject,
  resetTestState,
} from "./helpers";

test.describe("agent patch", () => {
  test("agent panel renders with prompt textarea and send button", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // The agent-panel testid exists on both the tabpanel wrapper and the
    // inner AgentPanel component. Use .first() to target one.
    const agentPanels = page.getByTestId("agent-panel");
    await expect(agentPanels.first()).toBeVisible();

    // Prompt textarea exists
    const promptTextarea = page.getByTestId("agent-prompt");
    await expect(promptTextarea).toBeVisible();
    await expect(promptTextarea).toBeEnabled();

    // Send button exists but is disabled when prompt is empty
    const sendButton = page.getByTestId("agent-send");
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();
  });

  test("typing in agent prompt enables the send button", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    const sendButton = page.getByTestId("agent-send");
    await expect(sendButton).toBeDisabled();

    // Type a prompt
    const promptTextarea = page.getByTestId("agent-prompt");
    await promptTextarea.fill("Make bars 1-8 more energetic");

    // Send button should now be enabled
    await expect(sendButton).toBeEnabled();

    // Click send (exercises the button; Zustand draft state updates)
    await sendButton.click();
  });

  test("patch preview via bridge returns valid proposal for seeded project", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Create a real project on disk with sections
    const { projectId, ir } = await createAndSeedProject(page);
    const sections = ir.sections as Array<{ style: { genre: string } }>;
    expect(sections[0]?.style.genre).toBe("minimal piano");

    // Call the bridge preview endpoint directly (exercises real code path)
    const result = await apiPreviewPatch(page, projectId, {
      summary: "Agent patch: restyle section A",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "dark cinematic",
        },
        {
          op: "replace",
          path: "/sections/0/style/energy",
          value: 0.75,
        },
      ],
      musicalDiff: {
        barsChanged: [1, 8],
        notesAdded: 4,
        notesRemoved: 1,
        preservedMotifs: ["motif_main"],
      },
    });

    expect(result.proposal.proposalId).toBeTruthy();
    expect(result.proposal.summary).toBe("Agent patch: restyle section A");

    // previewIr should reflect changes
    const previewSections = result.previewIr.sections as Array<{
      style: { genre: string; energy: number };
    }>;
    expect(previewSections[0]?.style.genre).toBe("dark cinematic");
    expect(previewSections[0]?.style.energy).toBe(0.75);
  });

  test("apply patch via bridge mutates project IR and creates snapshot", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const { projectId, ir } = await createAndSeedProject(page);
    const beforeSections = ir.sections as Array<{
      style: { genre: string };
    }>;
    expect(beforeSections[0]?.style.genre).toBe("minimal piano");

    // Apply patch through the bridge
    const applied = await apiApplyPatch(page, projectId, {
      summary: "Agent: apply genre change",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "dark ambient cinematic",
        },
      ],
    });

    expect(applied.snapshotId).toBeTruthy();
    expect(applied.proposalId).toBeTruthy();

    // Verify mutation persisted in project IR
    const after = await apiGetProject(page, projectId);
    const afterSections = after.ir.sections as Array<{
      style: { genre: string };
    }>;
    expect(afterSections[0]?.style.genre).toBe("dark ambient cinematic");
  });

  test("patch preview and apply on a newly created project", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const { projectId } = await createAndSeedProject(page);

    // Preview patch
    const preview = await apiPreviewPatch(page, projectId, {
      summary: "Change tempo and key",
      patch: [
        { op: "replace", path: "/tempo", value: 140 },
        { op: "replace", path: "/key", value: "D minor" },
      ],
    });

    expect(preview.previewIr.tempo).toBe(140);
    expect(preview.previewIr.key).toBe("D minor");

    // Apply patch
    const applied = await apiApplyPatch(page, projectId, {
      summary: "Change tempo and key",
      patch: [
        { op: "replace", path: "/tempo", value: 140 },
        { op: "replace", path: "/key", value: "D minor" },
      ],
    });

    expect(applied.ir.tempo).toBe(140);
    expect(applied.ir.key).toBe("D minor");

    // Verify persisted
    const reloaded = await apiGetProject(page, projectId);
    expect(reloaded.ir.tempo).toBe(140);
    expect(reloaded.ir.key).toBe("D minor");
  });

  test("schema-invalid patch preview returns 400 from bridge", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const { projectId } = await createAndSeedProject(page);

    let errorCaught = false;
    try {
      await apiPreviewPatch(page, projectId, {
        summary: "Invalid: sections must be array",
        patch: [
          {
            op: "replace",
            path: "/sections",
            value: "not-an-array",
          },
        ],
      });
    } catch {
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
  });

  test("reject flow: agent prompt interaction is functional", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Create a project via bridge to exercise real code path
    const { projectId } = await createAndSeedProject(page);
    expect(projectId).toBeTruthy();

    // Type a prompt in the agent panel
    const promptTextarea = page.getByTestId("agent-prompt");
    await promptTextarea.fill("Test reject flow");
    await expect(promptTextarea).toHaveValue("Test reject flow");

    // Send button becomes enabled
    const sendButton = page.getByTestId("agent-send");
    await expect(sendButton).toBeEnabled();

    // Click send (UI interaction only; no API wired from AgentPanel yet)
    await sendButton.click();

    // After clicking send, the prompt remains (current AgentPanel does not clear on send)
    await expect(promptTextarea).toHaveValue("Test reject flow");
  });

  test("export-midi button is visible in the top bar", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    const exportButton = page.getByTestId("export-midi");
    await expect(exportButton).toBeVisible();
  });
});
