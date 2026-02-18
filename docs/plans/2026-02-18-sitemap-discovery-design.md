# Sitemap-Based URL Discovery + Ignore Robots.txt Option

## Problem

Sites with SPA-style homepages (minimal `<a href>` links) produce crawls with only 1 page. The crawler relies solely on link extraction from HTML, which fails when navigation is JS-rendered or behind authentication. Example: `preexam.app` has only 2 homepage links — `/` (self) and `/sign-in` (blocked by robots.txt).

## Solution

Two changes:

### 1. Sitemap-Based URL Discovery (Crawler)

After fetching robots.txt, parse any declared sitemaps and add discovered URLs to the crawl frontier before the main crawl loop begins.

**Flow:**

1. `RobotsChecker` already parses `Sitemap:` directives from robots.txt
2. New `sitemap.rs` module fetches and parses sitemap XML
3. Handles both standard sitemaps (`<urlset>`) and sitemap indexes (`<sitemapindex>`)
4. Extracted URLs are filtered through robots.txt (unless ignore flag is set)
5. URLs are added to the frontier at depth 0 (same priority as seed URLs)
6. `max_pages` limit is respected — stop adding after cap

**Sitemap parsing:**

- Standard: `<urlset><url><loc>https://...</loc></url></urlset>`
- Index: `<sitemapindex><sitemap><loc>https://.../sitemap-1.xml</loc></sitemap></sitemapindex>`
- For indexes, fetch each child sitemap (limit to first 5 to avoid huge sitemaps)
- Filter URLs to same domain as seed (no cross-domain)

**Files:**

- New: `apps/crawler/src/crawler/sitemap.rs`
- Modify: `apps/crawler/src/crawler/mod.rs` (add `pub mod sitemap`)
- Modify: `apps/crawler/src/jobs/mod.rs` (add sitemap URLs to frontier)
- Update: `SitemapAnalysis` in `models.rs` with real `url_count`

### 2. Ignore Robots.txt Toggle (Full-Stack)

Allow users to bypass robots.txt when scanning their own sites.

**API changes:**

- Add `ignoreRobots: z.boolean().optional()` to `UpdateProjectSchema` in `packages/shared`
- In `buildCrawlConfig`: `respect_robots: !(settings.ignoreRobots)`

**Frontend changes:**

- Add checkbox in project settings: "Ignore robots.txt (use for your own sites)"

## Non-Goals

- Full sitemap validation/reporting (already tracked in site_context)
- Sitemap submission or generation
- Crawl budget optimization based on sitemap priority/lastmod
