/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  describeWithApi,
  testData,
  createTestServerAndClient,
  callToolAndParse,
  setupTestData,
} from "./helpers";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describeWithApi("MCP Tools — Real API Integration", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestServerAndClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
    await setupTestData(client);
  }, 120_000); // 2 min — may need to wait for crawl

  afterAll(async () => cleanup());

  it("lists all 27 registered tools", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(27);
  });

  // ── Projects ────────────────────────────────────────────────────────
  describe("Projects", () => {
    it("list_projects returns array with projects", async () => {
      const { data, isError } = await callToolAndParse<any[]>(
        client,
        "list_projects",
      );
      expect(isError).toBe(false);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("domain");
    });

    it("get_project returns project details", async () => {
      const { data, isError } = await callToolAndParse<any>(
        client,
        "get_project",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
      expect(data).toHaveProperty("id", testData.projectId);
      expect(data).toHaveProperty("domain");
    });

    it("get_project with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_project", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Crawls ──────────────────────────────────────────────────────────
  describe("Crawls", () => {
    it("list_crawls returns crawl history", async () => {
      const { data, isError } = await callToolAndParse<any[]>(
        client,
        "list_crawls",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
      expect(Array.isArray(data)).toBe(true);
    });

    it("list_crawls with limit=1 returns at most 1", async () => {
      const { data } = await callToolAndParse<any[]>(client, "list_crawls", {
        projectId: testData.projectId,
        limit: 1,
      });
      expect(data.length).toBeLessThanOrEqual(1);
    });

    it("get_crawl_status with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_crawl_status", {
        crawlId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Pages ───────────────────────────────────────────────────────────
  describe("Pages", () => {
    it("list_pages returns page list", async () => {
      const { isError } = await callToolAndParse<any>(client, "list_pages", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("get_page_details with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_page_details", {
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Scores ──────────────────────────────────────────────────────────
  describe("Scores", () => {
    it("get_site_score returns score breakdown", async () => {
      const { isError } = await callToolAndParse<any>(
        client,
        "get_site_score",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_score_history returns historical data", async () => {
      const { isError } = await callToolAndParse<any>(
        client,
        "get_score_history",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_site_score with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_site_score", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Issues ──────────────────────────────────────────────────────────
  describe("Issues", () => {
    it("list_issues returns issues", async () => {
      const { isError } = await callToolAndParse<any>(client, "list_issues", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("list_issues with severity filter works", async () => {
      const { isError } = await callToolAndParse(client, "list_issues", {
        projectId: testData.projectId,
        severity: "critical",
      });
      expect(isError).toBe(false);
    });

    it("list_issues with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "list_issues", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Visibility ──────────────────────────────────────────────────────
  describe("Visibility", () => {
    it("list_visibility_history returns data", async () => {
      const { isError } = await callToolAndParse(
        client,
        "list_visibility_history",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("list_visibility_history with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(
        client,
        "list_visibility_history",
        { projectId: FAKE_UUID },
      );
      expect(isError).toBe(true);
    });
  });

  // ── Strategy ────────────────────────────────────────────────────────
  describe("Strategy", () => {
    it("get_recommendations returns data", async () => {
      const { isError } = await callToolAndParse(
        client,
        "get_recommendations",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_content_gaps returns data", async () => {
      const { isError } = await callToolAndParse(client, "get_content_gaps", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });
  });

  // ── Competitors ─────────────────────────────────────────────────────
  describe("Competitors", () => {
    it("list_competitors returns data", async () => {
      const { isError } = await callToolAndParse(client, "list_competitors", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("compare_competitor returns data", async () => {
      const { isError } = await callToolAndParse(client, "compare_competitor", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });
  });

  // ── Content ─────────────────────────────────────────────────────────
  describe("Content", () => {
    it("analyze_content with fake pageId returns error", async () => {
      const { isError } = await callToolAndParse(client, "analyze_content", {
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });

    it("suggest_meta_tags with fake pageId returns error", async () => {
      const { isError } = await callToolAndParse(client, "suggest_meta_tags", {
        projectId: testData.projectId,
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Technical ───────────────────────────────────────────────────────
  describe("Technical", () => {
    it("check_llms_txt returns validation result", async () => {
      const { isError } = await callToolAndParse(client, "check_llms_txt", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("validate_schema with fake pageId returns error", async () => {
      const { isError } = await callToolAndParse(client, "validate_schema", {
        projectId: testData.projectId,
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Keywords & Queries ──────────────────────────────────────────────
  describe("Keywords & Queries", () => {
    it("discover_keywords returns data", async () => {
      const { isError } = await callToolAndParse(client, "discover_keywords", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("suggest_queries returns data", async () => {
      const { isError } = await callToolAndParse(client, "suggest_queries", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });
  });

  // ── Reports ─────────────────────────────────────────────────────────
  describe("Reports", () => {
    it("generate_report returns report content", async () => {
      const { isError } = await callToolAndParse(client, "generate_report", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("generate_report with fake projectId returns error", async () => {
      const { isError } = await callToolAndParse(client, "generate_report", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Fixes ───────────────────────────────────────────────────────────
  describe("Fixes", () => {
    it("generate_fix with fake data returns error", async () => {
      const { isError } = await callToolAndParse(client, "generate_fix", {
        projectId: FAKE_UUID,
        pageId: FAKE_UUID,
        issueCode: "FAKE_ISSUE",
      });
      expect(isError).toBe(true);
    });
  });
});
