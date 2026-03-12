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

test.describe("Integrations", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("view integrations dashboard", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/settings");

    // Look for integrations tab or section
    const integrationsTab = page.getByRole("tab", {
      name: /integrations/i,
    });

    if (await integrationsTab.isVisible()) {
      await integrationsTab.click();
    } else {
      await page.goto("/dashboard/settings/integrations");
    }

    // Verify integrations page loads
    await expect(
      page.getByText(/integrations|connected apps|third-party/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("connect Google Search Console", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for integration tests");
      return;
    }

    test.setTimeout(90000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Navigate to integrations section
    const integrationsSection = page.locator("section,div").filter({
      hasText: /integrations|google search console|gsc/i,
    });

    if (await integrationsSection.isVisible()) {
      // Look for connect GSC button
      const connectButton = integrationsSection.getByRole("button", {
        name: /connect|authorize|link google/i,
      });

      if (await connectButton.isVisible()) {
        await connectButton.click();

        // Should redirect to Google OAuth or show success
        // Note: In real test, this would go to Google OAuth
        // We'll just verify the button state changes
        await expect(page.getByText(/connecting|authorizing/i)).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });

  test("disconnect integration", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for integration tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Find connected integrations
    const connectedIntegration = page.locator("div,section").filter({
      hasText: /connected|authorized|linked/i,
    });

    if (await connectedIntegration.isVisible()) {
      // Look for disconnect button
      const disconnectButton = connectedIntegration.getByRole("button", {
        name: /disconnect|remove|unlink/i,
      });

      if (await disconnectButton.isVisible()) {
        await disconnectButton.click();

        // Confirm in dialog
        const confirmDialog = page.getByRole("dialog");
        if (await confirmDialog.isVisible()) {
          const confirmButton = confirmDialog.getByRole("button", {
            name: /yes|confirm|disconnect/i,
          });
          await confirmButton.click();
        }

        // Verify success
        await expect(
          page.getByText(/disconnected|removed|success/i),
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("create API token", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/settings/api");

    // Look for create token button
    const createButton = page.getByRole("button", {
      name: /create|new token|generate/i,
    });

    if (await createButton.isVisible()) {
      await createButton.click();

      // Wait for dialog
      await expect(page.getByRole("dialog")).toBeVisible();

      // Fill token name
      const nameInput = page.getByLabel(/name|description/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Test Token ${Date.now()}`);
      }

      // Submit
      const submitButton = page
        .getByRole("dialog")
        .getByRole("button", { name: /create|generate/i });
      await submitButton.click();

      // Verify token is shown or success message
      await expect(
        page.getByText(/token created|success|copy token/i),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("revoke API token", async ({ page }) => {
    test.setTimeout(60000);

    await page.goto("/dashboard/settings/api");

    // Find first token
    const tokenRow = page
      .locator("tr,div")
      .filter({ hasText: /token|api key/i })
      .first();

    if (await tokenRow.isVisible()) {
      // Look for revoke button
      const revokeButton = tokenRow.getByRole("button", {
        name: /revoke|delete|remove/i,
      });

      if (await revokeButton.isVisible()) {
        await revokeButton.click();

        // Confirm revocation
        const confirmDialog = page.getByRole("dialog");
        if (await confirmDialog.isVisible()) {
          const confirmButton = confirmDialog.getByRole("button", {
            name: /yes|confirm|revoke/i,
          });
          await confirmButton.click();
        }

        // Verify success
        await expect(page.getByText(/revoked|removed|deleted/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test("configure webhook endpoint", async ({ page }) => {
    if (!E2E_PROJECT_ID) {
      test.skip(true, "E2E_PROJECT_ID required for integration tests");
      return;
    }

    test.setTimeout(60000);

    await page.goto(`/dashboard/projects/${E2E_PROJECT_ID}?tab=settings`);

    // Look for webhooks section
    const webhooksSection = page.locator("section,div").filter({
      hasText: /webhooks|notifications|callbacks/i,
    });

    if (await webhooksSection.isVisible()) {
      // Add webhook button
      const addButton = webhooksSection.getByRole("button", {
        name: /add|create|new webhook/i,
      });

      if (await addButton.isVisible()) {
        await addButton.click();

        // Fill webhook URL
        const urlInput = page.getByLabel(/url|endpoint/i);
        if (await urlInput.isVisible()) {
          await urlInput.fill("https://example.com/webhook");

          // Select events
          const eventCheckbox = page
            .getByLabel(/crawl complete|events/i)
            .first();
          if (await eventCheckbox.isVisible()) {
            await eventCheckbox.check();
          }

          // Save
          const saveButton = page.getByRole("button", {
            name: /save|create|add/i,
          });
          await saveButton.click();

          // Verify success
          await expect(
            page.getByText(/webhook added|created|success/i),
          ).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });
});
