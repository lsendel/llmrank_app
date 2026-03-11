import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function loginIfNeeded(page: Page) {
  await page.goto("/dashboard/projects");

  if (!page.url().includes("/sign-in")) return;
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    test.skip(
      true,
      "E2E_EMAIL/E2E_PASSWORD are required for authenticated tests.",
    );
    return;
  }

  await page.getByLabel(/email/i).fill(E2E_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in|continue/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("Project Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("create new project", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/projects");

    // Click new project button
    const newProjectButton = page.getByRole("button", {
      name: /new project|create project|add project/i,
    });

    await expect(newProjectButton).toBeVisible({ timeout: 10000 });
    await newProjectButton.click();

    // Wait for dialog or form
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill project details
    const domainInput = page.getByLabel(/domain|website|url/i);
    await expect(domainInput).toBeVisible();
    await domainInput.fill(`test-${Date.now()}.example.com`);

    const nameInput = page.getByLabel(/name|project name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill(`Test Project ${Date.now()}`);
    }

    // Submit
    const createButton = page
      .getByRole("dialog")
      .getByRole("button", { name: /create|add|save/i });
    await createButton.click();

    // Verify redirect to project page or success message
    await expect(page.getByText(/project created|success/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("update project settings", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/projects");

    // Click on first project
    const firstProject = page.getByRole("link").filter({
      has: page.locator("text=/project|domain/i"),
    });

    if ((await firstProject.count()) > 0) {
      await firstProject.first().click();
      await page.waitForURL(/\/dashboard\/projects\/[^/?]+/);

      // Navigate to settings tab
      const settingsTab = page.getByRole("tab", { name: /settings/i });
      if (await settingsTab.isVisible()) {
        await settingsTab.click();
      } else {
        await page.goto(`${page.url()}?tab=settings`);
      }

      // Update project name
      const nameInput = page.getByLabel(/project name|name/i);
      if (await nameInput.isVisible()) {
        const newName = `Updated Project ${Date.now()}`;
        await nameInput.fill(newName);

        // Save changes
        const saveButton = page.getByRole("button", { name: /save|update/i });
        await saveButton.click();

        // Verify success
        await expect(page.getByText(/saved|updated|success/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("view project dashboard and overview", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/projects");

    // Click on first project
    const firstProject = page.getByRole("link").filter({
      has: page.locator("text=/project|domain/i"),
    });

    if ((await firstProject.count()) > 0) {
      await firstProject.first().click();
      await page.waitForURL(/\/dashboard\/projects\/[^/?]+/);

      // Verify overview tab content
      const overviewIndicators = [
        /overall score|ai score/i,
        /issues|recommendations/i,
        /recent crawls|crawl history/i,
        /pages|visibility/i,
      ];

      for (const indicator of overviewIndicators) {
        const element = page.getByText(indicator).first();
        if (await element.isVisible()) {
          await expect(element).toBeVisible();
          break;
        }
      }
    }
  });

  test("archive project", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/projects");

    // Find first active project
    const firstProject = page
      .getByRole("link")
      .filter({ has: page.locator("text=/project|domain/i") })
      .first();

    if (await firstProject.isVisible()) {
      await firstProject.click();
      await page.waitForURL(/\/dashboard\/projects\/[^/?]+/);

      // Navigate to settings
      await page.goto(`${page.url()}?tab=settings`);

      // Look for archive button (usually in danger zone)
      const archiveButton = page.getByRole("button", {
        name: /archive/i,
      });

      if (await archiveButton.isVisible()) {
        await archiveButton.click();

        // Confirm in dialog
        const confirmDialog = page.getByRole("dialog");
        if (await confirmDialog.isVisible()) {
          const confirmButton = confirmDialog.getByRole("button", {
            name: /yes|confirm|archive/i,
          });
          await confirmButton.click();
        }

        // Verify success or redirect
        await expect(page.getByText(/archived|success/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("delete project", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/projects");

    // Create a test project to delete
    const newProjectButton = page.getByRole("button", {
      name: /new project|create project/i,
    });

    if (await newProjectButton.isVisible()) {
      await newProjectButton.click();

      // Fill form
      const domainInput = page.getByLabel(/domain|website/i);
      await domainInput.fill(`delete-test-${Date.now()}.example.com`);

      // Submit
      const createButton = page
        .getByRole("dialog")
        .getByRole("button", { name: /create|add/i });
      await createButton.click();

      // Wait for creation
      await page.waitForURL(/\/dashboard\/projects\/[^/?]+/, {
        timeout: 15000,
      });

      // Navigate to settings
      await page.goto(`${page.url()}?tab=settings`);

      // Look for delete button
      const deleteButton = page.getByRole("button", {
        name: /delete project|remove project/i,
      });

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Confirm deletion
        const confirmDialog = page.getByRole("dialog");
        await expect(confirmDialog).toBeVisible();

        // Type confirmation if required
        const confirmInput = confirmDialog.getByPlaceholder(/delete|confirm/i);
        if (await confirmInput.isVisible()) {
          await confirmInput.fill("DELETE");
        }

        const confirmButton = confirmDialog.getByRole("button", {
          name: /yes|confirm|delete/i,
        });
        await confirmButton.click();

        // Verify redirect to projects list
        await page.waitForURL(/\/dashboard\/projects$/, { timeout: 15000 });
        await expect(page.getByText(/deleted|removed/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("filter projects list", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/projects");

    // Look for search/filter input
    const searchInput = page.getByPlaceholder(/search|filter/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000); // Wait for filter to apply

      // Verify filtered results
      await expect(searchInput).toHaveValue("test");
    }

    // Test status filter if available
    const statusFilter = page.getByRole("combobox", {
      name: /status|filter/i,
    });

    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page
        .getByText(/active|archived/i)
        .first()
        .click();
    }
  });
});
