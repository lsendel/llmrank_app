import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL;

function toUrl(pathname: string): string {
  if (!BASE_URL) {
    throw new Error("BASE_URL is required for smoke tests");
  }
  return new URL(pathname, BASE_URL).toString();
}

test.describe("Smoke Tests - Main Application Flows", () => {
  test("Homepage loads correctly", async ({ page }) => {
    test.skip(
      !BASE_URL,
      "Set BASE_URL to the app under test, for example http://localhost:3000",
    );

    await page.goto(toUrl("/"));
    await expect(page).toHaveTitle(/rank in chatgpt|llm rank/i);
    await expect(
      page
        .getByRole("link", { name: /run free ai audit|get started/i })
        .first(),
    ).toBeVisible();
  });

  test("Sign up and login pages load", async ({ page }) => {
    test.skip(
      !BASE_URL,
      "Set BASE_URL to the app under test, for example http://localhost:3000",
    );

    await page.goto(toUrl("/sign-in"));
    await expect(
      page.getByRole("heading", { name: /sign in|welcome back/i }).first(),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    await page.goto(toUrl("/sign-up"));
    await expect(
      page.getByRole("heading", { name: /sign up|start optimizing/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign up|create account|continue/i }),
    ).toBeVisible();
  });
});
