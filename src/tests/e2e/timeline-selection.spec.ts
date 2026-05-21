import { expect, test } from "@playwright/test";
import {
  createAndSeedProject,
  expectCanvasNotBlank,
  resetTestState,
} from "./helpers";

test.describe("timeline and selection", () => {
  test("timeline canvas renders and is not blank", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    // Verify timeline canvas element is visible and has dimensions
    const timeline = page.getByTestId("timeline-canvas");
    await expect(timeline).toBeVisible();

    await expectCanvasNotBlank(page, "timeline-canvas");
  });

  test("piano-roll canvas renders and is not blank", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    // Switch to piano-roll tab
    await page.getByTestId("editor-tabs").getByText("Piano Roll").click();

    const pianoRoll = page.getByTestId("piano-roll-canvas");
    await expect(pianoRoll).toBeVisible();

    await expectCanvasNotBlank(page, "piano-roll-canvas");
  });

  test("seeded project exists on bridge and sections display in left rail", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Create a real project on disk with sections (exercises the bridge)
    const { projectId } = await createAndSeedProject(page);
    expect(projectId).toBeTruthy();

    // The React app uses sampleMusicIr statically (imported fixture), so
    // verify the static sections are visible in the left rail.
    const leftRail = page.getByTestId("left-rail");
    await expect(leftRail).toBeVisible();

    // Sample data includes section named "A" (rendered as text in the UI)
    await expect(leftRail).toContainText("A");
    // Bar range text is also displayed
    await expect(leftRail).toContainText("Bars");
  });

  test("inspector shows default no-bar-selection state", async ({ page }) => {
    await page.goto("/");
    await resetTestState(page);

    const inspector = page.getByTestId("inspector");
    await expect(inspector).toBeVisible();

    // Default Zustand state: selectedBarRange is null
    await expect(inspector).toContainText("No bar selection");
  });

  test("transport controls are visible and contain play button", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const transport = page.getByTestId("transport");
    await expect(transport).toBeVisible();

    const playButton = page.getByTestId("transport-play");
    await expect(playButton).toBeVisible();

    const stopButton = page.getByTestId("transport-stop");
    await expect(stopButton).toBeVisible();
  });
});
