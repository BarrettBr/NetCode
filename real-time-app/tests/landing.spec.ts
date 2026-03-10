import { expect, test } from "@playwright/test";

test("landing page renders redesigned hero and primary actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('a[href="/home"]').first().click();
  await expect(page).toHaveURL(/\/home$/);

  await expect(
    page.locator("h1", { hasText: "Collaborative coding, kept simple." })
  ).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "NetCode gives you a shared editor, execution, and review in one browser workspace."
  );

  await expect(page.locator("body")).toContainText("Open Editor");
  await expect(page.locator("body")).toContainText("Explore Workspace");
  await expect(page.locator('a[href="/"]')).toHaveCount(1);
  await expect(page.locator('a[href="/workspace"]')).toHaveCount(1);

  await expect(page.locator("body")).toContainText("This is what we do");
  await expect(page.locator("body")).toContainText("Shared editing");
  await expect(page.locator("body")).toContainText("Flow");
  await expect(page.locator("body")).toContainText("Write, run, review");
});

test("landing page stays within viewport on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('a[href="/home"]').first().click();
  await expect(page).toHaveURL(/\/home$/);

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator("body")).toContainText("Open Editor");
  await expect(page.locator("body")).toContainText("Explore Workspace");
});
