import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;
const E2E_PROJECT_ID = process.env.E2E_PROJECT_ID;
const E2E_SCAN_DOMAIN = process.env.E2E_SCAN_DOMAIN ?? "example.com";

function pathname(url: string): string {
  return new URL(url).pathname;
}

function extractProjectId(url: string): string | null {
  const match = url.match(/\/dashboard\/projects\/([^/?]+)/);
  return match?.[1] ?? null;
}

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
  test("scan-to-workspace lifecycle covers defaults, crawl, actions, and automation", async ({
    page,
  }) => {
    test.setTimeout(240000);

    await loginIfNeeded(page);

    await page.goto("/scan");
    await page.getByPlaceholder("example.com").fill(E2E_SCAN_DOMAIN);
    await page.getByRole("button", { name: /run scan/i }).click();

    await page.waitForURL(/\/scan\/results\?id=/, { timeout: 120000 });
    await expect(
      page.getByRole("heading", { name: /AI visibility report/i }),
    ).toBeVisible();

    const scheduleDefaultsRequest = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" &&
        /^\/api\/projects\/[^/]+$/.test(pathname(request.url())),
      { timeout: 30000 },
    );
    const pipelineDefaultsRequest = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" &&
        /^\/api\/pipeline\/[^/]+\/settings$/.test(pathname(request.url())),
      { timeout: 30000 },
    );
    const visibilityDefaultsRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        pathname(request.url()) === "/api/visibility/schedules",
      { timeout: 30000 },
    );

    await page
      .getByRole("button", { name: "Create Project Workspace" })
      .click();

    await Promise.all([
      scheduleDefaultsRequest,
      pipelineDefaultsRequest,
      visibilityDefaultsRequest,
    ]);

    await page.waitForURL(
      /\/dashboard\/projects\/[^/?]+\?tab=overview&source=scan/,
      { timeout: 120000 },
    );

    const projectId = extractProjectId(page.url());
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    await expect(page.getByText("First 7 days plan")).toBeVisible();

    const crawlStartRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        pathname(request.url()) === "/api/crawls",
      { timeout: 30000 },
    );
    const firstSevenDaysCard = page.locator("section,div").filter({
      hasText: "First 7 days plan",
    });
    await firstSevenDaysCard
      .getByRole("button", { name: /Run crawl/i })
      .first()
      .click();
    await crawlStartRequest;
    await page.waitForURL(/\/dashboard\/crawl\/[^/?]+/, { timeout: 120000 });

    await page.goto(`/dashboard/projects/${projectId}?tab=actions`);
    await expect(
      page.getByText(
        /Recommended Next Actions|No urgent gaps detected|Could not load recommended actions right now/i,
      ),
    ).toBeVisible();

    await page.goto(`/dashboard/projects/${projectId}?tab=automation`);
    await expect(page.getByText("Pipeline Settings")).toBeVisible();

    const autoRunToggle = page.locator("#auto-run-on-crawl");
    await expect(autoRunToggle).toBeVisible();
    await expect(autoRunToggle).toBeChecked();

    const rerunPipelineRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        /^\/api\/projects\/[^/]+\/rerun-auto-generation$/.test(
          pathname(request.url()),
        ),
      { timeout: 30000 },
    );

    await page.getByRole("button", { name: "Run Pipeline Now" }).click();
    await rerunPipelineRequest;
    await expect(page.getByText("Automation Status")).toBeVisible();
  });

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
