import { describe, expect, it } from "vitest";
import {
  botBadgeClass,
  formatAiBotRate,
  resolveLogSummary,
} from "./logs-tab-helpers";

describe("logs-tab helpers", () => {
  it("formats the AI bot rate with a zero fallback", () => {
    expect(formatAiBotRate({ totalRequests: 0, crawlerRequests: 0 })).toBe(
      "0%",
    );
    expect(formatAiBotRate({ totalRequests: 25, crawlerRequests: 10 })).toBe(
      "40.0%",
    );
  });

  it("resolves the latest summary before falling back to upload history", () => {
    const uploadSummary = {
      totalRequests: 10,
      crawlerRequests: 3,
      uniqueIPs: 2,
      botBreakdown: [],
      statusBreakdown: [],
      topPaths: [],
    };
    const latestSummary = {
      totalRequests: 20,
      crawlerRequests: 8,
      uniqueIPs: 4,
      botBreakdown: [],
      statusBreakdown: [],
      topPaths: [],
    };

    expect(
      resolveLogSummary({
        latestSummary,
        uploads: [
          {
            id: "upload-1",
            projectId: "proj-1",
            filename: "access.log",
            totalRequests: 10,
            crawlerRequests: 3,
            uniqueIPs: 2,
            summary: uploadSummary,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ).toEqual(latestSummary);
    expect(botBadgeClass("ClaudeBot (Anthropic)")).toContain("bg-purple-100");
    expect(botBadgeClass("UnknownBot")).toBe("");
  });
});
