import { describe, it, expect } from "vitest";
import {
  classifyBot,
  isCrawler,
  parseLogLine,
  summarizeLogs,
  type LogEntry,
} from "../../domain/log-analysis";

describe("classifyBot", () => {
  it("classifies GPTBot user agent", () => {
    expect(classifyBot("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe(
      "GPTBot (OpenAI)",
    );
  });

  it("classifies ClaudeBot user agent", () => {
    expect(classifyBot("ClaudeBot/1.0")).toBe("ClaudeBot (Anthropic)");
  });

  it("classifies Googlebot user agent", () => {
    expect(
      classifyBot(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe("Googlebot");
  });

  it("classifies PerplexityBot user agent", () => {
    expect(classifyBot("PerplexityBot/1.0")).toBe("PerplexityBot");
  });

  it("returns 'Unknown' for unrecognized user agent", () => {
    expect(classifyBot("Mozilla/5.0 (Windows NT 10.0; Win64)")).toBe("Unknown");
  });

  it("is case-insensitive", () => {
    expect(classifyBot("GPTBOT/1.0")).toBe("GPTBot (OpenAI)");
    expect(classifyBot("claudebot/2.0")).toBe("ClaudeBot (Anthropic)");
  });
});

describe("isCrawler", () => {
  it("returns true for known crawler user agents", () => {
    expect(isCrawler("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe(true);
    expect(isCrawler("Googlebot/2.1")).toBe(true);
  });

  it("returns false for regular browser user agents", () => {
    expect(
      isCrawler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    ).toBe(false);
  });
});

describe("parseLogLine", () => {
  it("parses a valid combined log format line", () => {
    const line =
      '192.168.1.1 - - [14/Feb/2026:10:30:00 +0000] "GET /about HTTP/1.1" 200 5432 "https://example.com" "Mozilla/5.0 (compatible; GPTBot/1.0)"';
    const entry = parseLogLine(line);
    expect(entry).not.toBeNull();
    expect(entry!.ip).toBe("192.168.1.1");
    expect(entry!.method).toBe("GET");
    expect(entry!.path).toBe("/about");
    expect(entry!.statusCode).toBe(200);
    expect(entry!.responseSize).toBe(5432);
    expect(entry!.botLabel).toBe("GPTBot (OpenAI)");
    expect(entry!.isCrawler).toBe(true);
  });

  it("returns null for an invalid line", () => {
    expect(parseLogLine("this is not a log line")).toBeNull();
    expect(parseLogLine("")).toBeNull();
  });

  it("parses a non-crawler user agent correctly", () => {
    const line =
      '10.0.0.1 - - [14/Feb/2026:11:00:00 +0000] "GET /page HTTP/1.1" 200 1234 "-" "Mozilla/5.0 (Windows NT 10.0)"';
    const entry = parseLogLine(line);
    expect(entry).not.toBeNull();
    expect(entry!.botLabel).toBe("Unknown");
    expect(entry!.isCrawler).toBe(false);
  });
});

describe("summarizeLogs", () => {
  const sampleEntries: LogEntry[] = [
    {
      ip: "1.1.1.1",
      timestamp: "14/Feb/2026:10:00:00 +0000",
      method: "GET",
      path: "/",
      statusCode: 200,
      userAgent: "GPTBot/1.0",
      responseSize: 1000,
      botLabel: "GPTBot (OpenAI)",
      isCrawler: true,
    },
    {
      ip: "1.1.1.1",
      timestamp: "14/Feb/2026:10:01:00 +0000",
      method: "GET",
      path: "/about",
      statusCode: 200,
      userAgent: "GPTBot/1.0",
      responseSize: 2000,
      botLabel: "GPTBot (OpenAI)",
      isCrawler: true,
    },
    {
      ip: "2.2.2.2",
      timestamp: "14/Feb/2026:10:02:00 +0000",
      method: "GET",
      path: "/",
      statusCode: 200,
      userAgent: "Googlebot/2.1",
      responseSize: 1500,
      botLabel: "Googlebot",
      isCrawler: true,
    },
    {
      ip: "3.3.3.3",
      timestamp: "14/Feb/2026:10:03:00 +0000",
      method: "GET",
      path: "/contact",
      statusCode: 404,
      userAgent: "Mozilla/5.0",
      responseSize: 500,
      botLabel: "Unknown",
      isCrawler: false,
    },
  ];

  it("calculates total and crawler request counts", () => {
    const summary = summarizeLogs(sampleEntries);
    expect(summary.totalRequests).toBe(4);
    expect(summary.crawlerRequests).toBe(3);
  });

  it("counts unique IPs", () => {
    const summary = summarizeLogs(sampleEntries);
    expect(summary.uniqueIPs).toBe(3);
  });

  it("produces correct bot breakdown sorted by count", () => {
    const summary = summarizeLogs(sampleEntries);
    expect(summary.botBreakdown[0].bot).toBe("GPTBot (OpenAI)");
    expect(summary.botBreakdown[0].count).toBe(2);
    expect(summary.botBreakdown[1].bot).toBe("Googlebot");
    expect(summary.botBreakdown[1].count).toBe(1);
  });

  it("produces correct status breakdown", () => {
    const summary = summarizeLogs(sampleEntries);
    const status200 = summary.statusBreakdown.find((s) => s.status === 200);
    const status404 = summary.statusBreakdown.find((s) => s.status === 404);
    expect(status200?.count).toBe(3);
    expect(status404?.count).toBe(1);
  });

  it("produces topPaths from crawler requests", () => {
    const summary = summarizeLogs(sampleEntries);
    expect(summary.topPaths.length).toBeGreaterThan(0);
    // "/" was visited by GPTBot + Googlebot = 2 times
    const rootPath = summary.topPaths.find((p) => p.path === "/");
    expect(rootPath?.count).toBe(2);
  });

  it("handles empty input", () => {
    const summary = summarizeLogs([]);
    expect(summary.totalRequests).toBe(0);
    expect(summary.crawlerRequests).toBe(0);
    expect(summary.uniqueIPs).toBe(0);
    expect(summary.botBreakdown).toEqual([]);
  });
});
