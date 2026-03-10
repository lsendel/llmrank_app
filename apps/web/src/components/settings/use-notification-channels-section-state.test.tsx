import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useNotificationChannelsSectionState } from "./use-notification-channels-section-state";

const { mockUseApiSWR, mockMutateChannels } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
  mockMutateChannels: vi.fn(async () => undefined),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useNotificationChannelsSectionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "billing-info") {
        return { data: { plan: "starter" } };
      }

      if (key === "notification-channels") {
        return {
          data: [
            {
              id: "channel-1",
              userId: "user-1",
              type: "email",
              config: { email: "alerts@example.com" },
              eventTypes: ["crawl_completed"],
              enabled: true,
              createdAt: "2026-03-07T12:00:00.000Z",
              updatedAt: "2026-03-07T12:00:00.000Z",
            },
          ],
          mutate: mockMutateChannels,
        };
      }

      return {};
    });

    api.channels.create = vi.fn(async () => ({
      id: "channel-created",
      userId: "user-1",
      type: "email",
      config: { email: "ops@example.com" },
      eventTypes: ["crawl_completed", "score_drop"],
      enabled: true,
      createdAt: "2026-03-07T12:00:00.000Z",
      updatedAt: "2026-03-07T12:00:00.000Z",
    }));
    api.channels.update = vi.fn(async () => ({
      id: "channel-1",
      userId: "user-1",
      type: "email",
      config: { email: "alerts@example.com" },
      eventTypes: ["crawl_completed"],
      enabled: false,
      createdAt: "2026-03-07T12:00:00.000Z",
      updatedAt: "2026-03-07T12:00:00.000Z",
    }));
    api.channels.delete = vi.fn(async () => undefined);
  });

  it("derives limits and validates then creates channels", async () => {
    const { result } = renderHook(() => useNotificationChannelsSectionState());

    await waitFor(() => {
      expect(result.current.maxChannels).toBe(3);
      expect(result.current.channels).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleCreateChannel();
    });

    expect(result.current.channelError).toBe("Please provide a value.");

    act(() => {
      result.current.handleAddChannelOpenChange(true);
      result.current.handleChannelConfigValueChange("ops@example.com");
      result.current.handleToggleEventType("score_drop");
    });

    await act(async () => {
      await result.current.handleCreateChannel();
    });

    expect(api.channels.create).toHaveBeenCalledWith({
      type: "email",
      config: { email: "ops@example.com" },
      eventTypes: ["crawl_completed", "score_drop"],
    });
    expect(mockMutateChannels).toHaveBeenCalledTimes(1);
    expect(result.current.addChannelOpen).toBe(false);
    expect(result.current.channelConfigValue).toBe("");
    expect(result.current.channelType).toBe("email");
  });

  it("toggles and deletes channels", async () => {
    const { result } = renderHook(() => useNotificationChannelsSectionState());

    await waitFor(() => {
      expect(result.current.channels).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleToggleChannel(result.current.channels[0]!);
    });

    expect(api.channels.update).toHaveBeenCalledWith("channel-1", {
      enabled: false,
    });

    await act(async () => {
      await result.current.handleDeleteChannel("channel-1");
    });

    expect(api.channels.delete).toHaveBeenCalledWith("channel-1");
    expect(mockMutateChannels).toHaveBeenCalledTimes(2);
    expect(result.current.togglingChannelId).toBeNull();
    expect(result.current.deletingChannelId).toBeNull();
  });
});
