import { describe, it, expect } from "vitest";
import {
  meetsMinimumTier,
  getLimits,
  canAccessIntegration,
  canCreateProject,
  canRunVisibilityChecks,
} from "../domain/plan-enforcer";

describe("meetsMinimumTier", () => {
  it("free meets free", () => {
    expect(meetsMinimumTier("free", "free")).toBe(true);
  });
  it("free does not meet starter", () => {
    expect(meetsMinimumTier("free", "starter")).toBe(false);
  });
  it("pro meets starter", () => {
    expect(meetsMinimumTier("pro", "starter")).toBe(true);
  });
  it("agency meets all tiers", () => {
    expect(meetsMinimumTier("agency", "free")).toBe(true);
    expect(meetsMinimumTier("agency", "starter")).toBe(true);
    expect(meetsMinimumTier("agency", "pro")).toBe(true);
    expect(meetsMinimumTier("agency", "agency")).toBe(true);
  });
  it("starter does not meet pro", () => {
    expect(meetsMinimumTier("starter", "pro")).toBe(false);
  });
});

describe("getLimits", () => {
  it("returns correct limits for free plan", () => {
    const limits = getLimits("free");
    expect(limits.pagesPerCrawl).toBe(10);
    expect(limits.crawlsPerMonth).toBe(2);
    expect(limits.projects).toBe(1);
  });
  it("returns correct limits for agency plan", () => {
    const limits = getLimits("agency");
    expect(limits.pagesPerCrawl).toBe(2000);
    expect(limits.crawlsPerMonth).toBe(Infinity);
    expect(limits.projects).toBe(50);
  });
});

describe("canAccessIntegration", () => {
  it("free plan has no integrations", () => {
    expect(canAccessIntegration("free", "gsc")).toBe(false);
    expect(canAccessIntegration("free", "ga4")).toBe(false);
  });
  it("starter plan has no integrations", () => {
    expect(canAccessIntegration("starter", "gsc")).toBe(false);
  });
  it("pro plan has gsc and psi", () => {
    expect(canAccessIntegration("pro", "gsc")).toBe(true);
    expect(canAccessIntegration("pro", "psi")).toBe(true);
    expect(canAccessIntegration("pro", "ga4")).toBe(false);
  });
  it("agency plan has all integrations", () => {
    expect(canAccessIntegration("agency", "gsc")).toBe(true);
    expect(canAccessIntegration("agency", "psi")).toBe(true);
    expect(canAccessIntegration("agency", "ga4")).toBe(true);
    expect(canAccessIntegration("agency", "clarity")).toBe(true);
  });
});

describe("canCreateProject", () => {
  it("free plan: allows 0, rejects at 1", () => {
    expect(canCreateProject("free", 0)).toBe(true);
    expect(canCreateProject("free", 1)).toBe(false);
  });
  it("starter plan: allows up to 4, rejects at 5", () => {
    expect(canCreateProject("starter", 4)).toBe(true);
    expect(canCreateProject("starter", 5)).toBe(false);
  });
  it("pro plan: allows up to 19, rejects at 20", () => {
    expect(canCreateProject("pro", 19)).toBe(true);
    expect(canCreateProject("pro", 20)).toBe(false);
  });
  it("agency plan: allows up to 49", () => {
    expect(canCreateProject("agency", 49)).toBe(true);
    expect(canCreateProject("agency", 50)).toBe(false);
  });
});

describe("canRunVisibilityChecks", () => {
  it("free plan: 3 checks allowed", () => {
    expect(canRunVisibilityChecks("free", 0, 3)).toBe(true);
    expect(canRunVisibilityChecks("free", 2, 2)).toBe(false);
    expect(canRunVisibilityChecks("free", 3, 1)).toBe(false);
  });
  it("pro plan: 100 checks allowed", () => {
    expect(canRunVisibilityChecks("pro", 99, 1)).toBe(true);
    expect(canRunVisibilityChecks("pro", 100, 1)).toBe(false);
  });
  it("agency plan: 500 checks allowed", () => {
    expect(canRunVisibilityChecks("agency", 498, 2)).toBe(true);
    expect(canRunVisibilityChecks("agency", 499, 2)).toBe(false);
  });
});
