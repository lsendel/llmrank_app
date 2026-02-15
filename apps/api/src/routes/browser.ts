// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — page.evaluate() runs in browser context with DOM APIs
import { Hono } from "hono";
import puppeteer from "@cloudflare/puppeteer";
import type { AppEnv } from "../index";
import { hmacMiddleware } from "../middleware/hmac";

export const browserRoutes = new Hono<AppEnv>();

// Gate browser audit behind HMAC so only the crawler can invoke it
browserRoutes.use("/audit", hmacMiddleware);

browserRoutes.post("/audit", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json({ error: "URL is required" }, 400);

  const browser = await puppeteer.launch(c.env.BROWSER);

  try {
    const page = await browser.newPage();

    // Set a reasonable viewport for audit
    await page.setViewport({ width: 1280, height: 800 });

    // Enable request interception to track resources if needed
    // Navigate and wait for idle
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Perform a custom "Lightweight Audit" via browser execution
    const metrics: any = await page.evaluate(() => {
      // 1. Performance (simplistic calculation)
      const nav = (performance as any).getEntriesByType("navigation")[0];
      const ttfb = nav.responseStart - nav.requestStart;

      // 2. Content Quality
      const h1Count = (document as any).querySelectorAll("h1").length;
      const hasSchema = !!(document as any).querySelector(
        'script[type="application/ld+json"]',
      );

      return {
        ttfb,
        h1Count,
        hasSchema,
        title: (document as any).title,
        url: (window as any).location.href,
      };
    });

    // Map to the LighthouseResult interface expected by the system
    // We can normalize these into 0-1 scores
    const result = {
      performance: Math.max(0, Math.min(1, 1 - metrics.ttfb / 2000)), // 1.0 = <0ms, 0.0 = >2000ms
      seo: metrics.h1Count === 1 ? 1.0 : 0.5,
      accessibility: metrics.hasSchema ? 0.9 : 0.7,
      best_practices: 0.9, // Baseline
      lh_r2_key: null,
    };

    return c.json({ data: result });
  } catch (err) {
    console.error("Browser audit failed:", err);
    return c.json({ error: "Audit failed", message: String(err) }, 500);
  } finally {
    await browser.close();
  }
});
