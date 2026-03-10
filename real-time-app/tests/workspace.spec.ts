import { expect, test } from "@playwright/test";

test("workspace dashboard supports notes and file actions", async ({ page }) => {
  await page.goto("/workspace");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  await expect(page.getByText("Favorites")).toBeVisible();
  await expect(page.getByText("Recent Files")).toBeVisible();

  await page.locator('button[aria-label="New file"]').click();
  await page.locator('button[aria-label="New directory"]').click();

  await expect(page.getByText(/untitled-\d+\.ts/)).toBeVisible();
  await expect(page.getByText(/new-folder-\d+/)).toBeVisible();

  const noteInput = page.getByPlaceholder("Add a note...");
  await noteInput.fill("Ship the workspace polish after design review.");
  await noteInput.press("Enter");

  await expect(
    page.getByText("Ship the workspace polish after design review.")
  ).toBeVisible();
});

test("workspace code view stays editable after switching from the root editor", async ({
  page,
}) => {
  await page.goto("/");

  const rootEditor = page.locator('[data-editor-text]').first();
  await rootEditor.click();
  await page.keyboard.type("root text");
  await expect(rootEditor).toHaveAttribute("data-editor-text", /root text/);

  await page.goto("/workspace");
  await page.getByRole("button", { name: "Code", exact: true }).click();

  const workspaceEditor = page.locator('[data-editor-text]').first();
  await workspaceEditor.click();
  await page.keyboard.type(" workspace");

  await expect(workspaceEditor).toHaveAttribute(
    "data-editor-text",
    /root text workspace/
  );
});

test("workspace settings update the code editor configuration", async ({
  page,
}) => {
  await page.goto("/workspace");
  await page
    .locator("button")
    .filter({ hasText: /^Settings$/ })
    .first()
    .click();
  await expect(page.getByText("Editor preferences")).toBeVisible();

  await page.getByLabel("Font size").fill("18");
  await page.getByLabel("Font family").selectOption("JetBrains Mono");
  await page.getByLabel("Tab size").fill("2");

  await page.getByRole("button", { name: "Code", exact: true }).click();

  const workspaceEditor = page.locator('[data-editor-text]').first();
  await expect(workspaceEditor).toHaveAttribute("data-editor-font-size", "18");
  await expect(workspaceEditor).toHaveAttribute(
    "data-editor-font-family",
    "JetBrains Mono"
  );
  await expect(workspaceEditor).toHaveAttribute("data-editor-tab-size", "2");

  const beforeTab = (await workspaceEditor.getAttribute("data-editor-text")) ?? "";
  await workspaceEditor.click();
  await page.keyboard.press("Tab");
  const afterTab = (await workspaceEditor.getAttribute("data-editor-text")) ?? "";
  expect(afterTab.length).toBe(beforeTab.length + 2);
});
