#!/usr/bin/env node
// render-links.mjs — Headless Chromium link extractor for JS-rendered pages.
// Usage: node render-links.mjs <url>
// Outputs JSON to stdout: { "links": [{ "url", "anchor_text", "rel" }] }
// On error: { "error": "..." }

import puppeteer from "puppeteer-core";

const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/chromium";
const NAVIGATION_TIMEOUT = 12_000;
const IDLE_WAIT = 2_000;

const url = process.argv[2];
if (!url) {
  console.log(JSON.stringify({ error: "No URL provided" }));
  process.exit(1);
}

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();

  // Block images, fonts, and stylesheets — we only need the DOM
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "image" || type === "font" || type === "stylesheet") {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: NAVIGATION_TIMEOUT,
  });

  // Extra idle wait for late-firing JS frameworks
  await new Promise((r) => setTimeout(r, IDLE_WAIT));

  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    return Array.from(anchors).map((a) => ({
      url: a.href,
      anchor_text: (a.textContent || "").trim().slice(0, 500),
      rel: a.getAttribute("rel") || "",
    }));
  });

  console.log(JSON.stringify({ links }));
} catch (err) {
  console.log(JSON.stringify({ error: err.message || String(err) }));
  process.exit(1);
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
}
