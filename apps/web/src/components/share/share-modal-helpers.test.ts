import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildShareAssets,
  expiryOptionToDate,
  expiryToLabel,
} from "./share-modal-helpers";

describe("share modal helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts expiry options into future ISO dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T08:00:00.000Z"));

    expect(expiryOptionToDate("permanent")).toBeNull();
    expect(expiryOptionToDate("7")).toBe("2026-03-16T08:00:00.000Z");
  });

  it("formats active, permanent, and expired labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T08:00:00.000Z"));

    expect(expiryToLabel(null)).toBe("Permanent");
    expect(expiryToLabel("2026-03-10T08:00:00.000Z")).toBe("1 day remaining");
    expect(expiryToLabel("2026-03-08T08:00:00.000Z")).toBe("Expired");
  });

  it("builds share and badge embed assets from share info", () => {
    expect(
      buildShareAssets(
        {
          shareToken: "token-123",
          shareUrl: "https://ignored.example/share/token-123",
          badgeUrl: "https://ignored.example/badge.svg",
          level: "issues",
          expiresAt: null,
        },
        {
          origin: "https://llmrank.app",
          apiBaseUrl: "https://api.llmrank.app",
        },
      ),
    ).toEqual({
      shareUrl: "https://llmrank.app/share/token-123",
      badgeUrl: "https://api.llmrank.app/api/public/badge/token-123.svg",
      htmlBadgeEmbed:
        '<a href="https://llmrank.app/share/token-123" target="_blank" rel="noopener noreferrer"><img src="https://api.llmrank.app/api/public/badge/token-123.svg" alt="AI Readiness Score" /></a>',
      markdownBadgeEmbed:
        "[![AI Readiness Score](https://api.llmrank.app/api/public/badge/token-123.svg)](https://llmrank.app/share/token-123)",
    });
  });
});
