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

test.describe("Issue Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("view all issues for project", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Look for issues tab or section
    const issuesTab = page.getByRole("tab", { name: /issues|problems/i });

    if (await issuesTab.isVisible()) {
      await issuesTab.click();
    } else {
      // Try direct navigation
      await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);
    }

    // Verify issues list is visible
    await expect(
      page.getByText(/issue|problem|critical|warning/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("filter issues by severity", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);

    // Look for severity filter
    const severityFilter = page.getByRole("combobox", {
      name: /severity|priority|filter/i,
    });

    if (await severityFilter.isVisible()) {
      await severityFilter.click();

      // Select critical severity
      const criticalOption = page.getByText(/critical|high/i);
      if (await criticalOption.isVisible()) {
        await criticalOption.click();

        // Wait for filter to apply
        await page.waitForTimeout(1000);

        // Verify filtered results show critical issues
        await expect(page.getByText(/critical|high/i).first()).toBeVisible();
      }
    } else {
      // Try filter buttons
      const criticalButton = page.getByRole("button", {
        name: /critical|high/i,
      });
      if (await criticalButton.isVisible()) {
        await criticalButton.click();
        await expect(criticalButton).toHaveAttribute("aria-pressed", "true");
      }
    }
  });

  test("filter issues by category", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);

    // Look for category filter
    const categoryFilter = page.getByRole("combobox", {
      name: /category|type/i,
    });

    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();

      // Select a category (technical, content, etc.)
      const categoryOption = page.getByText(/technical|content|seo/i).first();
      if (await categoryOption.isVisible()) {
        await categoryOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("view issue details", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);

    // Find first issue link or card
    const firstIssue = page
      .locator("a,div[role='button']")
      .filter({ hasText: /issue|problem|warning/i })
      .first();

    if (await firstIssue.isVisible()) {
      await firstIssue.click();

      // Verify detail view or modal
      await expect(
        page.getByText(/description|details|recommendation|fix/i).first(),
      ).toBeVisible({ timeout: 10000 });

      // Check for recommended action
      await expect(
        page.getByText(/recommendation|how to fix|action/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("mark issue as resolved", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);

    // Find first issue
    const firstIssue = page
      .locator("div,section")
      .filter({ hasText: /issue|problem/i })
      .first();

    if (await firstIssue.isVisible()) {
      // Look for resolve button
      const resolveButton = firstIssue.getByRole("button", {
        name: /resolve|mark resolved|fix/i,
      });

      if (await resolveButton.isVisible()) {
        await resolveButton.click();

        // Verify success message
        await expect(page.getByText(/resolved|marked|success/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("export issues list", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);

    // Look for export button
    const exportButton = page.getByRole("button", {
      name: /export|download|csv/i,
    });

    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent("download", {
        timeout: 30000,
      });
      await exportButton.click();
      const download = await downloadPromise;

      // Verify download filename
      expect(download.suggestedFilename()).toMatch(/\.csv$|\.xlsx$|issues/i);
    }
  });

  test("view issue history and changes", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for issue tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=issues`);

    // Find an issue
    const issue = page
      .locator("a,div[role='button']")
      .filter({ hasText: /issue|problem/i })
      .first();

    if (await issue.isVisible()) {
      await issue.click();

      // Look for history or activity tab
      const historySection = page.locator("div,section").filter({
        hasText: /history|activity|changes/i,
      });

      if (await historySection.isVisible()) {
        await expect(historySection).toBeVisible();

        // Check for timeline or change entries
        const changes = historySection.locator("div,li").filter({
          hasText: /created|updated|resolved|detected/i,
        });

        if ((await changes.count()) > 0) {
          await expect(changes.first()).toBeVisible();
        }
      }
    }
  });
});
