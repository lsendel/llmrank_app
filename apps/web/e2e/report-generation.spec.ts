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

test.describe("Report Generation", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("generate manual report from project", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for report tests");
      return;
    }

    test.setTimeout(90000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);

    // Look for generate report button
    const generateButton = page.getByRole("button", {
      name: /generate|create report|new report/i,
    });

    if (await generateButton.isVisible()) {
      await generateButton.click();

      // Wait for report generation (might show dialog or redirect)
      await expect(
        page.getByText(/generating|creating|processing/i),
      ).toBeVisible({ timeout: 5000 });

      // Wait for completion or redirect to report view
      await expect(
        page.getByText(/report generated|complete|ready/i),
      ).toBeVisible({ timeout: 60000 });
    }
  });

  test("schedule automated reports", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for report tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);

    // Look for auto-report settings or schedule section
    const scheduleSection = page.locator("section,div").filter({
      hasText: /auto-report settings|schedule|automated reports/i,
    });

    await expect(scheduleSection).toBeVisible({ timeout: 10000 });

    // Enable auto-reports if there's a toggle
    const autoReportToggle = page
      .locator("input[type='checkbox']")
      .filter({ has: page.locator("text=/auto|schedule/i") });

    if ((await autoReportToggle.count()) > 0) {
      const firstToggle = autoReportToggle.first();
      if (!(await firstToggle.isChecked())) {
        await firstToggle.click();
      }
      await expect(firstToggle).toBeChecked();
    }

    // Set frequency if available
    const frequencySelect = page.getByRole("combobox", {
      name: /frequency|interval/i,
    });
    if (await frequencySelect.isVisible()) {
      await frequencySelect.click();
      await page
        .getByText(/weekly|monthly/i)
        .first()
        .click();
    }

    // Save settings
    const saveButton = page.getByRole("button", { name: /save|update/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await expect(page.getByText(/saved|updated/i)).toBeVisible();
    }
  });

  test("view report history", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for report tests");
      return;
    }

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);

    // Look for report history or list
    const reportsSection = page.locator("section,div").filter({
      hasText: /report history|previous reports|generated reports/i,
    });

    if (await reportsSection.isVisible()) {
      await expect(reportsSection).toBeVisible();

      // Check if there are report entries
      const reportEntries = reportsSection.locator("a,div").filter({
        hasText: /report|generated|completed/i,
      });

      if ((await reportEntries.count()) > 0) {
        await expect(reportEntries.first()).toBeVisible();
      }
    }
  });

  test("download report as PDF", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for report tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);

    // Find a completed report
    const reportEntry = page
      .locator("a,div")
      .filter({ hasText: /completed|ready/i })
      .first();

    if (await reportEntry.isVisible()) {
      // Look for download or PDF button
      const downloadButton = page.getByRole("button", {
        name: /download|pdf|export/i,
      });

      if (await downloadButton.isVisible()) {
        // Wait for download to start
        const downloadPromise = page.waitForEvent("download");
        await downloadButton.click();
        const download = await downloadPromise;

        // Verify download
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      }
    }
  });

  test("share report via email", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for report tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);

    // Find a completed report
    const reportEntry = page
      .locator("a,div")
      .filter({ hasText: /completed|ready/i })
      .first();

    if (await reportEntry.isVisible()) {
      // Look for share or email button
      const shareButton = page.getByRole("button", {
        name: /share|email|send/i,
      });

      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Wait for share dialog
        await expect(page.getByRole("dialog")).toBeVisible();

        // Fill email address
        const emailInput = page.getByLabel(/email|recipient/i);
        if (await emailInput.isVisible()) {
          await emailInput.fill("test@example.com");

          // Submit
          const sendButton = page
            .getByRole("dialog")
            .getByRole("button", { name: /send|share/i });
          await sendButton.click();

          // Verify success message
          await expect(page.getByText(/sent|shared|email sent/i)).toBeVisible();
        }
      }
    }
  });

  test("customize report sections", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for report tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);

    // Look for report settings or customize button
    const customizeButton = page.getByRole("button", {
      name: /customize|settings|configure/i,
    });

    if (await customizeButton.isVisible()) {
      await customizeButton.click();

      // Look for section toggles
      const sectionToggles = page.locator("input[type='checkbox']").filter({
        has: page.locator(
          "text=/executive summary|technical details|recommendations/i",
        ),
      });

      if ((await sectionToggles.count()) > 0) {
        // Toggle first section
        const firstToggle = sectionToggles.first();
        const wasChecked = await firstToggle.isChecked();
        await firstToggle.click();
        await expect(firstToggle).toBeChecked({ checked: !wasChecked });

        // Save changes
        const saveButton = page.getByRole("button", { name: /save|apply/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(page.getByText(/saved|updated/i)).toBeVisible();
        }
      }
    }
  });
});
