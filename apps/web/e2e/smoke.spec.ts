import { test, expect } from "@playwright/test";

test.describe("Smoke Tests - Main Application Flows", () => {
  test("Homepage loads correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Rank in ChatGPT/i); // Adjust based on actual title
    // Check for main heading or CTA
    const cta = page.getByRole("link", { name: /Sign/i }).first();
    await expect(cta).toBeVisible();
  });

  test("Sign up and login pages load", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("button", { name: /sign in|continue/i }),
    ).toBeVisible();

    await page.goto("/sign-up");
    await expect(
      page.getByRole("button", { name: /sign up|continue/i }),
    ).toBeVisible();
  });
});
