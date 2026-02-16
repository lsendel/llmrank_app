import { describe, it, expect, vi, afterEach } from "vitest";
import { webcrypto } from "node:crypto";
import { requestIdMiddleware } from "../../middleware/request-id";

const cryptoRef = ((globalThis as any).crypto ?? webcrypto) as Crypto;

describe("requestIdMiddleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("assigns a request id and header", async () => {
    const uuid = "req-123";
    vi.spyOn(cryptoRef, "randomUUID").mockReturnValue(uuid);

    const set = vi.fn();
    const header = vi.fn();
    const next = vi.fn().mockResolvedValue(undefined);

    await requestIdMiddleware(
      {
        set,
        header,
      } as any,
      next,
    );

    expect(set).toHaveBeenCalledWith("requestId", uuid);
    expect(header).toHaveBeenCalledWith("X-Request-ID", uuid);
    expect(next).toHaveBeenCalled();
  });
});
