import { describe, expect, it } from "vitest";
import {
  HOME_PAGE_FACTORS,
  HOME_PAGE_FAQ_ITEMS,
  HOME_PAGE_METADATA,
  HOME_PAGE_NAV_LINKS,
  HOME_PAGE_STEPS,
} from "./home-page-helpers";

describe("home page helpers", () => {
  it("keeps the scoring factor weights aligned with the landing copy", () => {
    const totalWeight = HOME_PAGE_FACTORS.reduce(
      (sum, factor) => sum + Number.parseInt(factor.weight, 10),
      0,
    );

    expect(totalWeight).toBe(100);
    expect(HOME_PAGE_FACTORS).toHaveLength(4);
  });

  it("preserves the homepage metadata and core navigation content", () => {
    expect(HOME_PAGE_METADATA.alternates?.canonical).toBe("/");
    expect(HOME_PAGE_METADATA.openGraph?.url).toBe("https://llmrank.app");
    expect(HOME_PAGE_NAV_LINKS.map((link) => link.href)).toEqual([
      "/ai-seo-tool",
      "/pricing",
    ]);
    expect(HOME_PAGE_STEPS).toHaveLength(3);
    expect(HOME_PAGE_FAQ_ITEMS).toHaveLength(4);
  });
});
