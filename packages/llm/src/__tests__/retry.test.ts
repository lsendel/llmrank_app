import { describe, it, expect, vi } from "vitest";
import { withRetry, withTimeout, TimeoutError } from "../retry";

describe("withRetry", () => {
  it("resolves on first attempt when function succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on later attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, 3, 1);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const err = new Error("persistent failure");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, 2, 1)).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-retryable client errors (e.g., 400)", async () => {
    const clientError = Object.assign(new Error("Bad Request"), {
      status: 400,
    });
    const fn = vi.fn().mockRejectedValue(clientError);

    await expect(withRetry(fn, 3, 1)).rejects.toThrow("Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 rate limit errors", async () => {
    const rateLimitError = Object.assign(new Error("Rate limited"), {
      status: 429,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue("success");

    const result = await withRetry(fn, 3, 1);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 server errors", async () => {
    const serverError = Object.assign(new Error("Server Error"), {
      status: 500,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, 3, 1);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("fast"), 1000);
    expect(result).toBe("fast");
  });

  it("rejects with TimeoutError when promise exceeds timeout", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));

    await expect(withTimeout(slowPromise, 10)).rejects.toThrow(TimeoutError);
    await expect(withTimeout(slowPromise, 10)).rejects.toThrow(
      "Request timed out after 10ms",
    );
  });

  it("propagates the original error if promise rejects before timeout", async () => {
    const failPromise = Promise.reject(new Error("original error"));

    await expect(withTimeout(failPromise, 5000)).rejects.toThrow(
      "original error",
    );
  });
});
