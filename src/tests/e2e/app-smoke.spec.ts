import { expect, test } from "@playwright/test";
import { expectCanvasNotBlank, resetTestState } from "./helpers";

test.describe("app smoke", () => {
  test("studio shell renders with all core panels visible", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // App shell
    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByTestId("top-bar")).toBeVisible();
    await expect(page.getByTestId("left-rail")).toBeVisible();
    await expect(page.getByTestId("right-inspector")).toBeVisible();
    await expect(page.getByTestId("bottom-panel")).toBeVisible();
  });

  test("timeline and piano-roll canvases are not blank", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Timeline
    const timeline = page.getByTestId("timeline-canvas");
    await expect(timeline).toBeVisible();
    await expectCanvasNotBlank(page, "timeline-canvas");

    // Piano roll
    await page.getByTestId("editor-tabs").getByText("Piano Roll").click();
    const pianoRoll = page.getByTestId("piano-roll-canvas");
    await expect(pianoRoll).toBeVisible();
    await expectCanvasNotBlank(page, "piano-roll-canvas");
  });

  test("agent panel renders with mock badge and empty prompt", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // The data-testid="agent-panel" appears on two elements:
    //   1. The Radix TabsContent wrapper (role="tabpanel")
    //   2. The inner AgentPanel component div
    // Use .first() to target one unambiguously.
    const agentPanels = page.getByTestId("agent-panel");
    await expect(agentPanels.first()).toBeVisible();

    // The inner AgentPanel div contains "Agent" heading and "Mock" badge.
    // nth(0) is the Radix TabsContent wrapper, nth(1) is the inner component.
    await expect(agentPanels.nth(1)).toContainText("Agent");
    await expect(agentPanels.nth(1)).toContainText("Mock");

    // Prompt textarea should be empty initially
    await expect(page.getByTestId("agent-prompt")).toBeEmpty();
  });

  test("transport bar is visible with play and stop controls", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    await expect(page.getByTestId("transport")).toBeVisible();
    await expect(page.getByTestId("transport-play")).toBeVisible();
    await expect(page.getByTestId("transport-stop")).toBeVisible();
  });

  test("editor tabs allow switching between timeline and piano-roll", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const editorTabs = page.getByTestId("editor-tabs");

    // Default: Timeline tab
    await expect(page.getByTestId("timeline-canvas")).toBeVisible();

    // Switch to Piano Roll
    await editorTabs.getByText("Piano Roll").click();
    await expect(page.getByTestId("piano-roll-canvas")).toBeVisible();

    // Switch back to Timeline
    await editorTabs.getByText("Timeline").click();
    await expect(page.getByTestId("timeline-canvas")).toBeVisible();
  });

  test("job queue tab is accessible in bottom panel", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    // Click the Jobs tab in the bottom panel
    const jobQueueTab = page.getByTestId("job-queue");
    await jobQueueTab.click();

    // Should show empty state
    await expect(page.getByTestId("bottom-panel")).toContainText(
      "No active jobs",
    );
  });
});
