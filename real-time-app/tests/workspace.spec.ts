import { expect, test } from "@playwright/test";

test("workspace dashboard supports notes and file actions", async ({ page }) => {
  await page.goto("/workspace");

  await expect(page.getByText("Favorites")).toBeVisible();
  await expect(page.getByText("Recent Files")).toBeVisible();

  await page.locator('button[aria-label="New file"]').click();
  await page.locator('button[aria-label="New directory"]').click();

  await expect(page.getByText(/untitled-\d+\.ts/)).toBeVisible();
  await expect(page.getByText(/new-folder-\d+/)).toBeVisible();

  const noteInput = page.getByPlaceholder("Add a note for this workspace...");
  await noteInput.fill("Ship the workspace polish after design review.");
  await noteInput.press("Enter");

  await expect(
    page.getByText("Ship the workspace polish after design review.")
  ).toBeVisible();
});
