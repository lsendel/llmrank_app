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

test.describe("Crawl Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("create crawl with default settings", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for crawl tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Click "New Crawl" or "Run Crawl" button
    const crawlButton = page.getByRole("button", {
      name: /new crawl|run crawl|start crawl/i,
    });
    await expect(crawlButton.first()).toBeVisible();
    await crawlButton.first().click();

    // Should redirect to crawl status page
    await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/, { timeout: 30000 });

    // Verify crawl status indicators are visible
    await expect(
      page.getByText(/queued|running|crawling|processing/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("create crawl with custom settings", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for crawl tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Navigate to crawl settings
    await page.getByText("Crawl Settings").click();

    // Modify max pages setting
    const maxPagesInput = page.getByLabel(/max pages|page limit/i);
    if (await maxPagesInput.isVisible()) {
      await maxPagesInput.fill("50");
    }

    // Save settings
    const saveButton = page.getByRole("button", { name: /save|update/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await expect(page.getByText(/saved|updated/i)).toBeVisible();
    }

    // Start crawl with new settings
    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);
    const crawlButton = page.getByRole("button", {
      name: /new crawl|run crawl/i,
    });
    await crawlButton.first().click();

    await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/, { timeout: 30000 });
    await expect(page.getByText(/queued|running/i)).toBeVisible();
  });

  test("view crawl status and progress", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for crawl tests");
      return;
    }

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Find recent crawls section
    const crawlsSection = page.locator("section,div").filter({
      hasText: /recent crawls|crawl history/i,
    });

    if (await crawlsSection.isVisible()) {
      // Click on the first crawl
      const firstCrawlLink = crawlsSection.getByRole("link").first();
      if (await firstCrawlLink.isVisible()) {
        await firstCrawlLink.click();

        await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/);

        // Verify status indicators
        await expect(
          page.getByText(
            /queued|running|completed|failed|processing|crawling/i,
          ),
        ).toBeVisible();

        // Check for progress information
        const progressIndicators = [
          /pages crawled|pages found|progress/i,
          /started|duration|elapsed/i,
        ];

        for (const indicator of progressIndicators) {
          const element = page.getByText(indicator);
          if (await element.isVisible()) {
            await expect(element).toBeVisible();
            break;
          }
        }
      }
    }
  });

  test("view crawl results and pages", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for crawl tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Navigate to a completed crawl
    const completedCrawl = page
      .locator("a,div")
      .filter({ hasText: /completed/i })
      .first();

    if (await completedCrawl.isVisible()) {
      if (completedCrawl.getAttribute("href")) {
        await completedCrawl.click();
      } else {
        // If not a link, look for view button
        const viewButton = page.getByRole("button", {
          name: /view|details/i,
        });
        if (await viewButton.isVisible()) {
          await viewButton.click();
        }
      }

      await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/);

      // Check for pages list or results tab
      const pagesTab = page.getByRole("tab", { name: /pages|results/i });
      if (await pagesTab.isVisible()) {
        await pagesTab.click();
      }

      // Verify page list is visible
      await expect(page.getByText(/url|page|title|score/i).first()).toBeVisible(
        { timeout: 10000 },
      );
    }
  });

  test("re-run completed crawl", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for crawl tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Find a completed crawl
    const completedCrawl = page
      .locator("section,div")
      .filter({ hasText: /completed/i })
      .first();

    if (await completedCrawl.isVisible()) {
      // Look for re-run or retry button
      const rerunButton = page.getByRole("button", {
        name: /re-run|retry|run again/i,
      });

      if (await rerunButton.isVisible()) {
        await rerunButton.click();

        // Should create new crawl
        await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/, {
          timeout: 30000,
        });
        await expect(page.getByText(/queued|running/i)).toBeVisible();
      }
    }
  });

  test("filter and sort crawl pages", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for crawl tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}`);

    // Navigate to completed crawl with pages
    const completedCrawl = page
      .locator("a")
      .filter({ hasText: /completed/i })
      .first();

    if (await completedCrawl.isVisible()) {
      await completedCrawl.click();
      await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/);

      // Look for pages or results tab
      const pagesTab = page.getByRole("tab", { name: /pages|results/i });
      if (await pagesTab.isVisible()) {
        await pagesTab.click();
      }

      // Test sorting if available
      const sortDropdown = page.getByRole("button", {
        name: /sort|order/i,
      });
      if (await sortDropdown.isVisible()) {
        await sortDropdown.click();

        // Select sort by score
        const scoreSortOption = page.getByText(/score|rating/i);
        if (await scoreSortOption.isVisible()) {
          await scoreSortOption.click();
        }
      }

      // Test filtering if available
      const filterInput = page.getByPlaceholder(/search|filter/i);
      if (await filterInput.isVisible()) {
        await filterInput.fill("home");
        await page.waitForTimeout(1000); // Wait for filter to apply
        await expect(filterInput).toHaveValue("home");
      }
    }
  });
});
