import { describe, expect, it } from "vitest";
import {
  resolveDashboardQuickToolOrder,
  resolveFirstSevenDaysOrder,
  resolveProjectGroupOrder,
  resolveProjectTabOrder,
} from "../personalization-layout";

describe("personalization layout", () => {
  it("uses stable defaults when persona is missing", () => {
    expect(resolveProjectGroupOrder()).toEqual([
      "analyze",
      "grow-visibility",
      "automate-operate",
      "configure",
    ]);
    expect(
      resolveDashboardQuickToolOrder({ persona: null, isAdmin: false }),
    ).toEqual(["strategy_personas", "competitor_tracking", "ai_visibility"]);
    expect(resolveFirstSevenDaysOrder()).toEqual([
      "crawl",
      "issues",
      "automation",
      "visibility",
    ]);
  });

  it("prioritizes visibility workflows for agency persona", () => {
    expect(resolveProjectGroupOrder({ persona: "agency" })).toEqual([
      "grow-visibility",
      "analyze",
      "automate-operate",
      "configure",
    ]);

    const orderedTabs = resolveProjectTabOrder(
      ["overview", "strategy", "issues", "visibility", "settings"],
      { persona: "agency" },
    );
    expect(orderedTabs).toEqual([
      "strategy",
      "visibility",
      "issues",
      "overview",
      "settings",
    ]);
  });

  it("prioritizes execution backlog for developer persona", () => {
    const orderedTabs = resolveProjectTabOrder(
      ["overview", "settings", "issues", "visibility", "pages", "logs"],
      { persona: "developer" },
    );
    expect(orderedTabs).toEqual([
      "issues",
      "pages",
      "overview",
      "settings",
      "logs",
      "visibility",
    ]);
  });

  it("applies admin override for configure and automation priorities", () => {
    expect(
      resolveProjectGroupOrder({ persona: "freelancer", isAdmin: true }),
    ).toEqual(["configure", "automate-operate", "analyze", "grow-visibility"]);

    const adminTabs = resolveProjectTabOrder(
      ["visibility", "settings", "automation", "issues"],
      { persona: "in_house", isAdmin: true },
    );
    expect(adminTabs).toEqual([
      "settings",
      "automation",
      "visibility",
      "issues",
    ]);
  });

  it("personalizes quick tools and 7-day sequence by persona", () => {
    expect(resolveDashboardQuickToolOrder({ persona: "in_house" })).toEqual([
      "ai_visibility",
      "strategy_personas",
      "competitor_tracking",
    ]);
    expect(resolveFirstSevenDaysOrder({ persona: "agency" })).toEqual([
      "crawl",
      "visibility",
      "issues",
      "automation",
    ]);
  });

  it("promotes operational defaults for admins in quick tools and 7-day plan", () => {
    expect(
      resolveDashboardQuickToolOrder({ persona: "freelancer", isAdmin: true }),
    ).toEqual(["competitor_tracking", "ai_visibility", "strategy_personas"]);
    expect(
      resolveFirstSevenDaysOrder({ persona: "freelancer", isAdmin: true }),
    ).toEqual(["automation", "crawl", "issues", "visibility"]);
  });
});
