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
      "E2E_EMAIL/E2E_PASSWORD are required for authenticated journeys.",
    );
    return;
  }

  await page.getByLabel(/email/i).fill(E2E_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in|continue/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("Operational Journeys", () => {
  test("project workflow surfaces load for strategy, reports, and automation", async ({
    page,
  }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(
        true,
        "E2E_PROJECT_ID is required for project lifecycle journey.",
      );
      return;
    }

    await loginIfNeeded(page);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=strategy`);
    await expect(page.getByText("Demand Model Flow")).toBeVisible();

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=reports`);
    await expect(page.getByText("Auto-Report Settings")).toBeVisible();

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=automation`);
    await expect(page.getByText("Pipeline Settings")).toBeVisible();
  });
});
