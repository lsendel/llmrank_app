import { describe, it, expect, beforeEach, vi } from "vitest";
import { captureError } from "../../lib/sentry";

const { captureExceptionMock, scope } = vi.hoisted(() => {
  return {
    captureExceptionMock: vi.fn(),
    scope: { setTag: vi.fn() },
  };
});

vi.mock("@sentry/cloudflare", () => ({
  captureException: captureExceptionMock,
  withScope: (
    cb: (scope: { setTag: (k: string, v: string) => void }) => void,
  ) => cb(scope),
}));

describe("captureError", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    scope.setTag.mockReset();
  });

  it("sets tags and forwards the error", () => {
    const error = new Error("boom");
    captureError(error, { foo: "bar", jobId: "job-1" });

    expect(scope.setTag).toHaveBeenCalledWith("foo", "bar");
    expect(scope.setTag).toHaveBeenCalledWith("jobId", "job-1");
    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });

  it("skips tag assignment when context missing", () => {
    captureError(new Error("oops"));
    expect(scope.setTag).not.toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});
