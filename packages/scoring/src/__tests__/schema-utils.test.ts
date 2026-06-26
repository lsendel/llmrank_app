import { describe, it, expect } from "vitest";
import {
  normalizeSchemaNodes,
  schemaTypesFromNodes,
  isEntityType,
} from "../schema-utils";

describe("normalizeSchemaNodes", () => {
  it("returns flat nodes unchanged", () => {
    const nodes = normalizeSchemaNodes([
      { "@type": "WebPage", name: "Home" },
      { "@type": "Organization", name: "Acme" },
    ]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n["@type"])).toEqual(["WebPage", "Organization"]);
  });

  it("descends into a @graph wrapper (the families.care shape)", () => {
    const nodes = normalizeSchemaNodes([
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "LocalBusiness", name: "Age Well South Bay" },
          { "@type": "BreadcrumbList" },
        ],
      },
    ]);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => !!n["@type"])).toBe(true);
    expect(schemaTypesFromNodes(nodes)).toEqual([
      "LocalBusiness",
      "BreadcrumbList",
    ]);
  });

  it("flattens a bare top-level array of nodes", () => {
    const nodes = normalizeSchemaNodes([
      [{ "@type": "Article" }, { "@type": "Person" }],
    ]);
    expect(schemaTypesFromNodes(nodes)).toEqual(["Article", "Person"]);
  });

  it("keeps a wrapper that has its own @type alongside its @graph children", () => {
    const nodes = normalizeSchemaNodes([
      { "@type": "WebSite", "@graph": [{ "@type": "Organization" }] },
    ]);
    expect(schemaTypesFromNodes(nodes)).toEqual(["WebSite", "Organization"]);
  });

  it("handles undefined / empty input", () => {
    expect(normalizeSchemaNodes(undefined)).toEqual([]);
    expect(normalizeSchemaNodes([])).toEqual([]);
  });

  it("treats a @graph wrapper with no children as no nodes", () => {
    expect(normalizeSchemaNodes([{ "@graph": [] }])).toEqual([]);
  });
});

describe("schemaTypesFromNodes", () => {
  it("collects string and array @type values", () => {
    const types = schemaTypesFromNodes([
      { "@type": "Article" },
      { "@type": ["Organization", "LocalBusiness"] },
      { name: "no type" },
    ]);
    expect(types).toEqual(["Article", "Organization", "LocalBusiness"]);
  });
});

describe("isEntityType", () => {
  it("recognizes the bare bases", () => {
    for (const t of ["Person", "Organization", "Product", "Place", "Event"]) {
      expect(isEntityType(t)).toBe(true);
    }
  });

  it("recognizes common subtypes that exact-match missed", () => {
    expect(isEntityType("LocalBusiness")).toBe(true);
    expect(isEntityType("MedicalOrganization")).toBe(true);
    expect(isEntityType("HomeAndConstructionBusiness")).toBe(true);
  });

  it("rejects non-entity types", () => {
    expect(isEntityType("WebPage")).toBe(false);
    expect(isEntityType("BreadcrumbList")).toBe(false);
  });
});
