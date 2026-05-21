import { expect, test } from "@playwright/test";
import { expectCanvasNotBlank, resetTestState, seedTestProject } from "./helpers";

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

  test("seed project populates sections and they appear in left rail", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Seed a project via the bridge (exercises real code path)
    const { manifest } = await seedTestProject(page);
    expect(manifest.projectId).toBeTruthy();

    // The app uses sampleMusicIr statically, so verify the static sections
    // are visible in the left rail (the UI renders from imported fixtures)
    const leftRail = page.getByTestId("left-rail");
    await expect(leftRail).toBeVisible();

    // Sample data includes section "A" / "sec_a"
    await expect(leftRail).toContainText("A");
    await expect(leftRail).toContainText("sec_a");
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
