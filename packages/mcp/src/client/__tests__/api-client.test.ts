import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "../api-client";
import { ApiClientError } from "../types";

describe("ApiClient", () => {
  const config = {
    baseUrl: "https://api.llmboost.io",
    apiToken: "llmb_test_token_123",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET requests with auth header", async () => {
    const mockResponse = { data: { id: "proj_1", name: "Test" } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const client = createApiClient(config);
    const result = await client.get("/api/projects/proj_1");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.llmboost.io/api/projects/proj_1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer llmb_test_token_123",
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("sends POST requests with JSON body", async () => {
    const mockResponse = { data: { id: "crawl_1" } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const client = createApiClient(config);
    const result = await client.post("/api/crawls", { domain: "example.com" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.llmboost.io/api/crawls",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ domain: "example.com" }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws ApiClientError on error responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: { code: "PLAN_LIMIT_REACHED", message: "Upgrade required" },
        }),
    });

    const client = createApiClient(config);
    await expect(client.get("/api/projects")).rejects.toThrow(ApiClientError);
    await expect(client.get("/api/projects")).rejects.toMatchObject({
      status: 403,
      code: "PLAN_LIMIT_REACHED",
    });
  });

  it("throws on network errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const client = createApiClient(config);
    await expect(client.get("/api/projects")).rejects.toThrow("Network error");
  });
});
