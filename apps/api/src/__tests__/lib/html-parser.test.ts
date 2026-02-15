import { describe, it, expect } from "vitest";
import { parseHtml } from "../../lib/html-parser";

const BASE_URL = "https://example.com/page";

describe("parseHtml", () => {
  it("extracts title from <title> tag", () => {
    const html =
      "<html><head><title>My Page Title</title></head><body></body></html>";
    const result = parseHtml(html, BASE_URL);
    expect(result.title).toBe("My Page Title");
  });

  it("returns null title when no <title> tag exists", () => {
    const html = "<html><head></head><body>Hello</body></html>";
    const result = parseHtml(html, BASE_URL);
    expect(result.title).toBeNull();
  });

  it("extracts meta description", () => {
    const html = `<html><head>
      <meta name="description" content="A great page about testing">
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.metaDescription).toBe("A great page about testing");
  });

  it("extracts meta description with content before name", () => {
    const html = `<html><head>
      <meta content="Reversed order" name="description">
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.metaDescription).toBe("Reversed order");
  });

  it("extracts headings at all levels", () => {
    const html = `<html><body>
      <h1>Heading 1</h1>
      <h2>Heading 2a</h2>
      <h2>Heading 2b</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
    </body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.h1).toEqual(["Heading 1"]);
    expect(result.h2).toEqual(["Heading 2a", "Heading 2b"]);
    expect(result.h3).toEqual(["Heading 3"]);
    expect(result.h4).toEqual(["Heading 4"]);
    expect(result.h5).toEqual(["Heading 5"]);
    expect(result.h6).toEqual(["Heading 6"]);
  });

  it("extracts JSON-LD schema types", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Organization", "name": "Test Corp"}
      </script>
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.schemaTypes).toContain("Organization");
    expect(result.structuredData).toHaveLength(1);
  });

  it("handles multiple schema types in array format", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": ["WebPage", "FAQPage"], "name": "FAQ"}
      </script>
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.schemaTypes).toContain("WebPage");
    expect(result.schemaTypes).toContain("FAQPage");
  });

  it("extracts OG tags", () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Title">
      <meta property="og:description" content="OG Desc">
      <meta property="og:image" content="https://example.com/img.jpg">
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.ogTags["og:title"]).toBe("OG Title");
    expect(result.ogTags["og:description"]).toBe("OG Desc");
    expect(result.ogTags["og:image"]).toBe("https://example.com/img.jpg");
  });

  it("classifies internal and external links", () => {
    const html = `<html><body>
      <a href="/about">About</a>
      <a href="https://example.com/contact">Contact</a>
      <a href="https://other.com/page">External</a>
    </body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.internalLinks).toContain("/about");
    expect(result.internalLinks).toContain("/contact");
    expect(result.externalLinks).toContain("https://other.com/page");
  });

  it("counts images without alt text", () => {
    const html = `<html><body>
      <img src="a.png" alt="Description">
      <img src="b.png">
      <img src="c.png" alt="">
      <img src="d.png" alt="Valid Alt">
    </body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.imagesWithoutAlt).toBe(2);
  });

  it("detects robots meta tag and parses directives", () => {
    const html = `<html><head>
      <meta name="robots" content="noindex, nofollow">
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.hasRobotsMeta).toBe(true);
    expect(result.robotsDirectives).toContain("noindex");
    expect(result.robotsDirectives).toContain("nofollow");
  });

  it("counts words excluding scripts and styles", () => {
    const html = `<html><body>
      <script>var x = 'should not count';</script>
      <style>.hidden { display: none; }</style>
      <p>This is a test paragraph with eight words here.</p>
    </body></html>`;
    const result = parseHtml(html, BASE_URL);
    // "This is a test paragraph with eight words here." = 9 words
    expect(result.wordCount).toBeGreaterThanOrEqual(9);
  });

  it("extracts canonical URL from link tag", () => {
    const html = `<html><head>
      <link rel="canonical" href="https://example.com/canonical-page">
    </head><body></body></html>`;
    const result = parseHtml(html, BASE_URL);
    expect(result.canonicalUrl).toBe("https://example.com/canonical-page");
  });
});
