import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShareModalState } from "./use-share-modal-state";

const toastMock = vi.fn();
const enableMock = vi.fn();
const updateMock = vi.fn();
const disableMock = vi.fn();
const clipboardWriteMock = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/api", () => {
  class MockApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }

  return {
    ApiError: MockApiError,
    api: {
      share: {
        enable: (...args: unknown[]) => enableMock(...args),
        update: (...args: unknown[]) => updateMock(...args),
        disable: (...args: unknown[]) => disableMock(...args),
      },
    },
  };
});

describe("useShareModalState", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    updateMock.mockResolvedValue({
      shareToken: "token-123",
      shareUrl: "https://llmrank.app/share/token-123",
      badgeUrl: "https://api.llmrank.app/api/public/badge/token-123.svg",
      level: "issues",
      expiresAt: "2026-03-16T08:00:00.000Z",
    });
    enableMock.mockResolvedValue({
      shareToken: "token-123",
      shareUrl: "https://llmrank.app/share/token-123",
      badgeUrl: "https://api.llmrank.app/api/public/badge/token-123.svg",
      level: "full",
      expiresAt: "2026-04-08T08:00:00.000Z",
    });
    disableMock.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteMock.mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks active share status on open and copies values", async () => {
    let resetCopiedField: (() => void) | undefined;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: TimerHandler,
    ) => {
      resetCopiedField = callback as () => void;
      return 0 as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const { result } = renderHook(() =>
      useShareModalState({ open: true, crawlId: "crawl-1" }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(updateMock).toHaveBeenCalledWith("crawl-1", {});

    expect(result.current.shareInfo?.shareToken).toBe("token-123");
    expect(result.current.updateLevel).toBe("issues");
    expect(result.current.shareUrl).toContain("/share/token-123");

    await act(async () => {
      await result.current.handleCopyToClipboard("copy me", "url");
    });

    expect(clipboardWriteMock).toHaveBeenCalledWith("copy me");
    expect(result.current.copiedField).toBe("url");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Copied" }),
    );

    expect(resetCopiedField).toBeDefined();

    act(() => {
      resetCopiedField?.();
    });

    expect(result.current.copiedField).toBeNull();
  });

  it("enables, updates, and revokes sharing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T08:00:00.000Z"));

    const { result } = renderHook(() =>
      useShareModalState({ open: false, crawlId: "crawl-1" }),
    );

    act(() => {
      result.current.setLevel("full");
      result.current.setExpiry("30");
      result.current.setConfirmRevoke(true);
    });

    await act(async () => {
      await result.current.handleEnable();
    });

    expect(enableMock).toHaveBeenCalledWith("crawl-1", {
      level: "full",
      expiresAt: "2026-04-08T08:00:00.000Z",
    });
    expect(result.current.shareInfo?.level).toBe("full");

    act(() => {
      result.current.setUpdateLevel("issues");
      result.current.setUpdateExpiry("7");
    });

    await act(async () => {
      await result.current.handleUpdate();
    });

    expect(updateMock).toHaveBeenCalledWith("crawl-1", {
      level: "issues",
      expiresAt: "2026-03-16T08:00:00.000Z",
    });

    await act(async () => {
      await result.current.handleRevoke();
    });

    expect(disableMock).toHaveBeenCalledWith("crawl-1");
    expect(result.current.shareInfo).toBeNull();
    expect(result.current.confirmRevoke).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sharing disabled" }),
    );
  });
});
