import { describe, it, expect } from "vitest";
import { scoreSchemaMarkup } from "../../dimensions/schema-markup";
import type { PageData } from "../../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example Site Here",
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine implementation here.",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["Main Heading"],
      h2: ["Section 1"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["Organization"],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://external.com"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {},
      structured_data: [
        {
          "@type": "Organization",
          name: "Example Inc",
          url: "https://example.com",
        },
      ],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: 20,
      top_transition_words: [],
    },
    lighthouse: null,
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
    ...overrides,
  };
}

describe("scoreSchemaMarkup", () => {
  it("returns 100 for a page with complete structured data and entity markup", () => {
    const result = scoreSchemaMarkup(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- NO_STRUCTURED_DATA ---

  it("NO_STRUCTURED_DATA: deducts 15 when structured_data is empty", () => {
    const page = makePage();
    page.extracted.structured_data = [];
    const result = scoreSchemaMarkup(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "NO_STRUCTURED_DATA",
        severity: "warning",
      }),
    );
  });

  it("NO_STRUCTURED_DATA: deducts 15 when structured_data is undefined", () => {
    const page = makePage();
    page.extracted.structured_data = undefined;
    const result = scoreSchemaMarkup(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "NO_STRUCTURED_DATA" }),
    );
  });

  it("NO_STRUCTURED_DATA: no deduction when structured data exists", () => {
    const result = scoreSchemaMarkup(makePage());
    const issue = result.issues.find((i) => i.code === "NO_STRUCTURED_DATA");
    expect(issue).toBeUndefined();
  });

  // --- INCOMPLETE_SCHEMA ---

  it("INCOMPLETE_SCHEMA: deducts 8 when Article schema is missing required props", () => {
    const page = makePage();
    page.extracted.structured_data = [
      { "@type": "Article", headline: "Test" },
      // Missing: author, datePublished
    ];
    page.extracted.schema_types = ["Article"];
    const result = scoreSchemaMarkup(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "INCOMPLETE_SCHEMA",
        severity: "warning",
      }),
    );
    const issue = result.issues.find((i) => i.code === "INCOMPLETE_SCHEMA");
    expect(issue?.data).toEqual(
      expect.objectContaining({
        schemaType: "Article",
        missingProps: ["author", "datePublished"],
      }),
    );
  });

  it("INCOMPLETE_SCHEMA: no deduction when all required Article props present", () => {
    const page = makePage();
    page.extracted.structured_data = [
      {
        "@type": "Article",
        headline: "Test",
        author: "John Doe",
        datePublished: "2025-01-01",
      },
    ];
    page.extracted.schema_types = ["Article", "Person"];
    const result = scoreSchemaMarkup(page);
    const issue = result.issues.find((i) => i.code === "INCOMPLETE_SCHEMA");
    expect(issue).toBeUndefined();
  });

  it("INCOMPLETE_SCHEMA: no deduction for unknown schema type", () => {
    const page = makePage();
    page.extracted.structured_data = [{ "@type": "CustomType", foo: "bar" }];
    page.extracted.schema_types = ["CustomType", "Person"];
    const result = scoreSchemaMarkup(page);
    const issue = result.issues.find((i) => i.code === "INCOMPLETE_SCHEMA");
    expect(issue).toBeUndefined();
  });

  it("INCOMPLETE_SCHEMA: only deducts once even with multiple incomplete schemas", () => {
    const page = makePage();
    page.extracted.structured_data = [
      { "@type": "Article", headline: "Test" }, // missing author, datePublished
      { "@type": "WebPage" }, // missing name, description
    ];
    page.extracted.schema_types = ["Article", "WebPage"];
    const result = scoreSchemaMarkup(page);
    const incompleteIssues = result.issues.filter(
      (i) => i.code === "INCOMPLETE_SCHEMA",
    );
    expect(incompleteIssues).toHaveLength(1);
  });

  // --- INVALID_SCHEMA ---

  it("INVALID_SCHEMA: deducts 8 when structured data item missing @type", () => {
    const page = makePage();
    page.extracted.structured_data = [
      { name: "No Type Here" }, // Missing @type
    ];
    page.extracted.schema_types = ["Organization"];
    const result = scoreSchemaMarkup(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_SCHEMA", severity: "warning" }),
    );
  });

  it("INVALID_SCHEMA: no deduction when all items have @type", () => {
    const result = scoreSchemaMarkup(makePage());
    const issue = result.issues.find((i) => i.code === "INVALID_SCHEMA");
    expect(issue).toBeUndefined();
  });

  // --- MISSING_ENTITY_MARKUP ---

  it("MISSING_ENTITY_MARKUP: deducts 5 when structured data has no entity types", () => {
    const page = makePage();
    page.extracted.structured_data = [
      { "@type": "WebPage", name: "Test", description: "Test page" },
    ];
    page.extracted.schema_types = ["WebPage"]; // No entity type (Person, Organization, etc.)
    const result = scoreSchemaMarkup(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_ENTITY_MARKUP",
        severity: "info",
      }),
    );
  });

  it("MISSING_ENTITY_MARKUP: no deduction when entity type present in schema_types", () => {
    const page = makePage();
    // Default page has Organization in schema_types
    const result = scoreSchemaMarkup(page);
    const issue = result.issues.find((i) => i.code === "MISSING_ENTITY_MARKUP");
    expect(issue).toBeUndefined();
  });

  it("MISSING_ENTITY_MARKUP: no deduction when no structured data at all (already caught by NO_STRUCTURED_DATA)", () => {
    const page = makePage();
    page.extracted.structured_data = [];
    page.extracted.schema_types = [];
    const result = scoreSchemaMarkup(page);
    const issue = result.issues.find((i) => i.code === "MISSING_ENTITY_MARKUP");
    expect(issue).toBeUndefined();
  });

  it("MISSING_ENTITY_MARKUP: recognizes Product as entity type", () => {
    const page = makePage();
    page.extracted.structured_data = [
      { "@type": "Product", name: "Widget", description: "A great widget" },
    ];
    page.extracted.schema_types = ["Product"];
    const result = scoreSchemaMarkup(page);
    const issue = result.issues.find((i) => i.code === "MISSING_ENTITY_MARKUP");
    expect(issue).toBeUndefined();
  });

  // --- @graph normalization (regression: families.care false positives) ---

  it("@graph: valid LocalBusiness/BreadcrumbList graph fires no false positives", () => {
    const page = makePage();
    // The real families.care shape: a single wrapper with @graph, no top-level @type.
    page.extracted.structured_data = [
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "LocalBusiness",
            name: "Age Well South Bay",
            address: "Torrance, CA",
          },
          { "@type": "BreadcrumbList" },
        ],
      },
    ];
    // Older crawl data stored an empty schema_types for @graph pages.
    page.extracted.schema_types = [];
    const result = scoreSchemaMarkup(page);
    const codes = result.issues.map((i) => i.code);
    expect(codes).not.toContain("INVALID_SCHEMA");
    expect(codes).not.toContain("MISSING_ENTITY_MARKUP");
    expect(codes).not.toContain("NO_STRUCTURED_DATA");
    expect(result.score).toBe(100);
  });

  // --- Multiple issues ---

  it("accumulates all schema issues for a page with no structured data", () => {
    const page = makePage();
    page.extracted.structured_data = [];
    page.extracted.schema_types = [];
    const result = scoreSchemaMarkup(page);
    // Only NO_STRUCTURED_DATA fires (others require structured_data.length > 0)
    expect(result.score).toBe(85);
    expect(result.issues).toHaveLength(1);
  });

  it("score never goes below 0", () => {
    const page = makePage();
    page.extracted.structured_data = [
      { name: "No Type" }, // INVALID_SCHEMA -8
      { "@type": "WebPage" }, // INCOMPLETE_SCHEMA -8 (missing name, description)
    ];
    page.extracted.schema_types = ["WebPage"]; // MISSING_ENTITY_MARKUP -5
    const result = scoreSchemaMarkup(page);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
