import { describe, it, expect } from "vitest";

describe("DiscoveryService", () => {
  describe("extractSiteSignals", () => {
    it(
      "extracts title, description, and brand from index page data",
      { timeout: 15000 },
      async () => {
        const { extractSiteSignals } =
          await import("../../services/discovery-service");
        const signals = extractSiteSignals({
          url: "https://example.com",
          title: "Example - Best Widget Platform",
          metaDescription: "The leading widget platform for businesses.",
          ogTags: { "og:title": "Example Widgets" },
        });

        expect(signals.brand).toBe("example");
        expect(signals.title).toBe("Example - Best Widget Platform");
        expect(signals.description).toBe(
          "The leading widget platform for businesses.",
        );
        expect(signals.domain).toBe("example.com");
      },
    );

    it("strips www prefix from domain", async () => {
      const { extractSiteSignals } =
        await import("../../services/discovery-service");
      const signals = extractSiteSignals({
        url: "https://www.example.com/page",
        title: null,
      });
      expect(signals.domain).toBe("example.com");
      expect(signals.brand).toBe("example");
    });

    it("falls back to og:description when metaDescription is missing", async () => {
      const { extractSiteSignals } =
        await import("../../services/discovery-service");
      const signals = extractSiteSignals({
        url: "https://example.com",
        ogTags: { "og:description": "OG fallback" },
      });
      expect(signals.description).toBe("OG fallback");
    });
  });

  describe("parseCompetitorDomains", () => {
    it("extracts domain names from Perplexity response text", async () => {
      const { parseCompetitorDomains } =
        await import("../../services/discovery-service");
      const domains = parseCompetitorDomains(
        "The main competitors are: 1. WidgetCo (widgetco.com) 2. SuperWidgets (superwidgets.io) 3. WidgetPro (widgetpro.com)",
        "example.com",
      );

      expect(domains).toContain("widgetco.com");
      expect(domains).toContain("superwidgets.io");
      expect(domains).toContain("widgetpro.com");
      expect(domains).not.toContain("example.com");
    });

    it("deduplicates domains", async () => {
      const { parseCompetitorDomains } =
        await import("../../services/discovery-service");
      const domains = parseCompetitorDomains(
        "Check widgetco.com and also widgetco.com again",
        "example.com",
      );
      expect(domains.filter((d) => d === "widgetco.com")).toHaveLength(1);
    });

    it("limits to 8 domains", async () => {
      const { parseCompetitorDomains } =
        await import("../../services/discovery-service");
      const domains = parseCompetitorDomains(
        "a.com b.com c.com d.com e.com f.com g.com h.com i.com j.com",
        "example.com",
      );
      expect(domains.length).toBeLessThanOrEqual(8);
    });
  });

  describe("parsePersonasAndKeywords", () => {
    it("parses structured JSON from Anthropic response", async () => {
      const { parsePersonasAndKeywords } =
        await import("../../services/discovery-service");
      const result = parsePersonasAndKeywords(
        JSON.stringify({
          personas: [
            {
              name: "Marketing Manager",
              role: "Marketing Manager",
              jobToBeDone: "Increase organic traffic",
              funnelStage: "comparison",
              sampleQueries: ["best SEO tools", "SEO tool comparison"],
            },
          ],
          keywords: [
            {
              keyword: "best SEO tools",
              funnelStage: "comparison",
              relevanceScore: 0.9,
            },
          ],
        }),
      );

      expect(result.personas).toHaveLength(1);
      expect(result.personas[0].name).toBe("Marketing Manager");
      expect(result.personas[0].funnelStage).toBe("comparison");
      expect(result.keywords).toHaveLength(1);
      expect(result.keywords[0].keyword).toBe("best SEO tools");
      expect(result.keywords[0].relevanceScore).toBe(0.9);
    });

    it("handles markdown code fences in response", async () => {
      const { parsePersonasAndKeywords } =
        await import("../../services/discovery-service");
      const result = parsePersonasAndKeywords(
        '```json\n{"personas":[],"keywords":[]}\n```',
      );
      expect(result.personas).toHaveLength(0);
      expect(result.keywords).toHaveLength(0);
    });

    it("defaults invalid funnelStage to education", async () => {
      const { parsePersonasAndKeywords } =
        await import("../../services/discovery-service");
      const result = parsePersonasAndKeywords(
        JSON.stringify({
          personas: [
            { name: "Test", role: "Test", funnelStage: "invalid_stage" },
          ],
          keywords: [],
        }),
      );
      expect(result.personas[0].funnelStage).toBe("education");
    });
  });
});
