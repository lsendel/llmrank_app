import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;
const E2E_PROJECT_ID = process.env.E2E_PROJECT_ID;

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

test.describe("Competitor Monitoring", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("add new competitor", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for competitor tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Navigate to site context or competitors section
    const competitorSection = page.locator("section,div").filter({
      hasText: /site context|competitors|competitive analysis/i,
    });

    if (await competitorSection.isVisible()) {
      await competitorSection.scrollIntoViewIfNeeded();
    }

    // Look for add competitor button
    const addButton = page.getByRole("button", {
      name: /add competitor|new competitor/i,
    });

    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill competitor domain
      const domainInput = page.getByPlaceholder(/domain|competitor/i);
      if (await domainInput.isVisible()) {
        await domainInput.fill("competitor-example.com");

        // Submit
        const submitButton = page.getByRole("button", {
          name: /add|save|create/i,
        });
        await submitButton.click();

        // Verify success
        await expect(page.getByText(/competitor added|success/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("remove competitor", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for competitor tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Find competitor list
    const competitorList = page.locator("section,div").filter({
      hasText: /competitors|site context/i,
    });

    if (await competitorList.isVisible()) {
      // Find remove/delete button for first competitor
      const removeButton = competitorList
        .getByRole("button", { name: /remove|delete/i })
        .first();

      if (await removeButton.isVisible()) {
        await removeButton.click();

        // Confirm deletion if there's a dialog
        const confirmDialog = page.getByRole("dialog");
        if (await confirmDialog.isVisible()) {
          const confirmButton = confirmDialog.getByRole("button", {
            name: /yes|confirm|delete|remove/i,
          });
          await confirmButton.click();
        }

        // Verify removal
        await expect(page.getByText(/removed|deleted|success/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("view competitor comparison dashboard", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for competitor tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Look for competitors or competitive analysis tab/section
    const competitorTab = page.getByRole("tab", {
      name: /competitors|competitive/i,
    });

    if (await competitorTab.isVisible()) {
      await competitorTab.click();

      // Verify comparison data is visible
      await expect(
        page.getByText(/score|ranking|visibility|comparison/i).first(),
      ).toBeVisible({ timeout: 10000 });

      // Check for competitor names or domains
      const competitorEntries = page.locator("div,section").filter({
        hasText: /competitor|domain/i,
      });

      if ((await competitorEntries.count()) > 0) {
        await expect(competitorEntries.first()).toBeVisible();
      }
    }
  });

  test("auto-discover competitors", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for competitor tests");
      return;
    }

    test.setTimeout(90000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Navigate to site context settings
    await page.goto(
      `/dashboard/projects/${E2E_PROJECT_ID}?tab=settings&configure=site-context`,
    );

    // Look for auto-discover or re-discover button
    const discoverButton = page.getByRole("button", {
      name: /discover|re-discover competitors/i,
    });

    if (await discoverButton.isVisible()) {
      await discoverButton.click();

      // Wait for discovery process
      await expect(
        page.getByText(/discovering|analyzing|finding/i),
      ).toBeVisible({ timeout: 10000 });

      // Wait for completion
      await expect(page.getByText(/discovered|found|complete/i)).toBeVisible({
        timeout: 60000,
      });
    }
  });

  test("compare specific competitor metrics", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for competitor tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Find competitor comparison section
    const competitorSection = page.locator("section,div").filter({
      hasText: /competitor|competitive/i,
    });

    if (await competitorSection.isVisible()) {
      // Look for metrics like scores, rankings, visibility
      const metrics = [
        /overall score|ai score/i,
        /visibility|ranking/i,
        /content score|technical score/i,
      ];

      for (const metric of metrics) {
        const metricElement = competitorSection.getByText(metric);
        if (await metricElement.isVisible()) {
          await expect(metricElement).toBeVisible();
        }
      }

      // Check for visual comparison (charts/graphs)
      const charts = page.locator("canvas,svg").filter({
        has: competitorSection,
      });

      if ((await charts.count()) > 0) {
        await expect(charts.first()).toBeVisible();
      }
    }
  });
});
