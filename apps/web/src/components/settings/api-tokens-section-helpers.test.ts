import { describe, expect, it } from "vitest";
import {
  canManageApiTokens,
  getMaxApiTokens,
  getTokenCreatedLabel,
  getTokenLastUsedLabel,
  resolveMcpSetupSnippets,
} from "./api-tokens-section-helpers";

describe("api tokens section helpers", () => {
  it("derives plan access and token limits", () => {
    expect(getMaxApiTokens("free")).toBe(0);
    expect(getMaxApiTokens("pro")).toBe(5);
    expect(getMaxApiTokens("agency")).toBe(20);
    expect(canManageApiTokens("starter")).toBe(false);
    expect(canManageApiTokens("agency")).toBe(true);
  });

  it("resolves setup snippets and token metadata labels", () => {
    const snippets = resolveMcpSetupSnippets("tok_live_123");

    expect(snippets).toHaveLength(4);
    expect(snippets[0]?.snippet).toContain("tok_live_123");
    expect(getTokenCreatedLabel("2026-03-07T12:00:00.000Z")).toMatch(
      /^Created /,
    );
    expect(getTokenLastUsedLabel("2026-03-08T12:00:00.000Z")).toMatch(
      /^Last used /,
    );
    expect(getTokenLastUsedLabel(null)).toBe("Never used");
  });
});
