import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithRetry } from "../../lib/fetch-retry";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Use baseDelayMs: 0 so retries don't wait, avoiding fake-timer complexity.
const NO_DELAY = { baseDelayMs: 0 };

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns response on first success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network error and succeeds", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry(
      "https://crawler.test/api/v1/jobs",
      { method: "POST" },
      NO_DELAY,
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry(
      "https://crawler.test/api/v1/jobs",
      { method: "POST" },
      NO_DELAY,
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await fetchWithRetry("https://crawler.test/api/v1/jobs", {
      method: "POST",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws after all retries exhausted on network error", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));

    await expect(
      fetchWithRetry(
        "https://crawler.test/api/v1/jobs",
        { method: "POST" },
        NO_DELAY,
      ),
    ).rejects.toThrow("fail 3");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns last 5xx response after all retries exhausted", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 504 });

    const result = await fetchWithRetry(
      "https://crawler.test/api/v1/jobs",
      { method: "POST" },
      NO_DELAY,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(504);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("respects custom maxRetries", async () => {
    mockFetch.mockRejectedValue(new Error("fail"));

    await expect(
      fetchWithRetry(
        "https://crawler.test/api/v1/jobs",
        { method: "POST" },
        { maxRetries: 2, baseDelayMs: 0 },
      ),
    ).rejects.toThrow("fail");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
