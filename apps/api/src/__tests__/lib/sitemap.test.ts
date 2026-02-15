import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseSitemapXml, analyzeSitemap } from "../../lib/sitemap";

// ---------------------------------------------------------------------------
// Mock fetch for analyzeSitemap
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// parseSitemapXml tests
// ---------------------------------------------------------------------------

describe("parseSitemapXml", () => {
  it("parses valid sitemap with URLs", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
        <url><loc>https://example.com/page2</loc></url>
      </urlset>`;
    const result = parseSitemapXml(xml);
    expect(result.exists).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.urlCount).toBe(2);
    expect(result.urls).toEqual([
      "https://example.com/page1",
      "https://example.com/page2",
    ]);
  });

  it("detects invalid XML without urlset or sitemapindex", () => {
    const xml = "<html><body>Not a sitemap</body></html>";
    const result = parseSitemapXml(xml);
    expect(result.exists).toBe(true);
    expect(result.isValid).toBe(false);
    expect(result.urlCount).toBe(0);
  });

  it("counts stale URLs with lastmod older than 12 months", () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/old</loc>
          <lastmod>${oldDate.toISOString()}</lastmod>
        </url>
        <url>
          <loc>https://example.com/fresh</loc>
          <lastmod>${recentDate.toISOString()}</lastmod>
        </url>
      </urlset>`;
    const result = parseSitemapXml(xml);
    expect(result.staleUrlCount).toBe(1);
    expect(result.lastmodDates).toHaveLength(2);
  });

  it("handles sitemap index format", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
      </sitemapindex>`;
    const result = parseSitemapXml(xml);
    expect(result.exists).toBe(true);
    // sitemapindex is not a urlset, so isValid = false
    expect(result.isValid).toBe(false);
    expect(result.urlCount).toBe(2);
  });

  it("returns zero stale count when no lastmod tags exist", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page</loc></url>
      </urlset>`;
    const result = parseSitemapXml(xml);
    expect(result.staleUrlCount).toBe(0);
    expect(result.lastmodDates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeSitemap tests
// ---------------------------------------------------------------------------

describe("analyzeSitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exists=false when fetch returns non-OK", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    const result = await analyzeSitemap("example.com");
    expect(result.exists).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.urlCount).toBe(0);
  });

  it("returns exists=false when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await analyzeSitemap("example.com");
    expect(result.exists).toBe(false);
    expect(result.isValid).toBe(false);
  });
});
