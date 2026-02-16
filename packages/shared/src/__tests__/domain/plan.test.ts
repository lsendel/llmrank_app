import { describe, it, expect } from "vitest";
import { Plan } from "../../domain/plan";

describe("Plan", () => {
  it("returns correct max projects for free tier", () => {
    const plan = Plan.from("free");
    expect(plan.maxProjects).toBe(1);
  });

  it("returns correct max projects for agency tier", () => {
    const plan = Plan.from("agency");
    expect(plan.maxProjects).toBe(50);
  });

  it("canCreateProject returns true when under limit", () => {
    const plan = Plan.from("starter");
    expect(plan.canCreateProject(3)).toBe(true);
  });

  it("canCreateProject returns false when at limit", () => {
    const plan = Plan.from("free");
    expect(plan.canCreateProject(1)).toBe(false);
  });

  it("meetsMinimumTier compares correctly", () => {
    const plan = Plan.from("pro");
    expect(plan.meetsMinimumTier("starter")).toBe(true);
    expect(plan.meetsMinimumTier("pro")).toBe(true);
    expect(plan.meetsMinimumTier("agency")).toBe(false);
  });

  it("free does not meet starter tier", () => {
    const plan = Plan.from("free");
    expect(plan.meetsMinimumTier("starter")).toBe(false);
  });

  it("getMaxPages returns correct value", () => {
    const plan = Plan.from("agency");
    expect(plan.maxPagesPerCrawl).toBe(2000);
  });

  it("canRunVisibilityChecks enforces limits", () => {
    const plan = Plan.from("free");
    expect(plan.canRunVisibilityChecks(2, 1)).toBe(true);
    expect(plan.canRunVisibilityChecks(3, 1)).toBe(false);
  });

  it("canGenerateReport enforces monthly limit and type", () => {
    const plan = Plan.from("free");
    expect(plan.canGenerateReport(0, "summary")).toBe(true);
    expect(plan.canGenerateReport(1, "summary")).toBe(false);
    expect(plan.canGenerateReport(0, "detailed")).toBe(false);
  });

  it("exposes tier property", () => {
    const plan = Plan.from("starter");
    expect(plan.tier).toBe("starter");
  });
});
