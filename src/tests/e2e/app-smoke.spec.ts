import { expect, test } from "@playwright/test";

test("studio shell renders with mocked project fixture", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("timeline-canvas")).toBeVisible();
  await expect(page.getByTestId("piano-roll-canvas")).toBeVisible();
  await expect(page.getByTestId("agent-panel")).toContainText("Mock agent ready");
});
