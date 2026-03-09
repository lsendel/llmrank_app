import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type NotificationPreferences } from "@/lib/api";
import { useGeneralSectionActions } from "./use-general-section-actions";

const { mockWithAuth, mockSignOut } = vi.hoisted(() => ({
  mockWithAuth: vi.fn((callback: () => Promise<unknown> | unknown) =>
    callback(),
  ),
  mockSignOut: vi.fn(async () => undefined),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

vi.mock("@/lib/auth-hooks", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

describe("useGeneralSectionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.account.updateProfile = vi.fn(async () => undefined);
    api.account.updateNotifications = vi.fn(async () => ({
      notifyOnCrawlComplete: true,
      notifyOnScoreDrop: false,
      webhookUrl: null,
    }));
    api.account.updateDigestPreferences = vi.fn(async () => ({
      digestFrequency: "weekly",
      digestDay: 1,
      lastDigestSentAt: null,
    }));
    api.account.deleteAccount = vi.fn(async () => undefined);
    api.crawls.deleteHistory = vi.fn(async () => ({ deleted: 2 }));
  });

  it("syncs persona/webhook state and toggles notifications optimistically", async () => {
    const mutateNotifications = vi.fn(async () => undefined);
    const mutateDigest = vi.fn(async () => undefined);
    const notifications: NotificationPreferences = {
      notifyOnCrawlComplete: true,
      notifyOnScoreDrop: false,
      webhookUrl: "https://hooks.example.com/abc",
    };

    const { result } = renderHook(() =>
      useGeneralSectionActions({
        mePersona: "agency",
        notifications,
        mutateNotifications,
        mutateDigest,
        projectsList: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.persona).toBe("agency");
      expect(result.current.webhookInput).toBe("https://hooks.example.com/abc");
    });

    await act(async () => {
      await result.current.handleToggleNotification("notifyOnCrawlComplete");
    });

    expect(mutateNotifications).toHaveBeenNthCalledWith(
      1,
      {
        notifyOnCrawlComplete: false,
        notifyOnScoreDrop: false,
        webhookUrl: "https://hooks.example.com/abc",
      },
      false,
    );
    expect(api.account.updateNotifications).toHaveBeenCalledWith({
      notifyOnCrawlComplete: false,
    });
    expect(result.current.savingNotification).toBeNull();
  });

  it("validates, saves, and removes webhook URLs", async () => {
    const mutateNotifications = vi.fn(async () => undefined);
    const mutateDigest = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGeneralSectionActions({
        mePersona: null,
        notifications: {
          notifyOnCrawlComplete: true,
          notifyOnScoreDrop: true,
          webhookUrl: null,
        },
        mutateNotifications,
        mutateDigest,
        projectsList: [],
      }),
    );

    act(() => {
      result.current.handleWebhookInputChange("http://hooks.example.com/abc");
    });

    await act(async () => {
      await result.current.handleSaveWebhook();
    });

    expect(result.current.webhookError).toBe("URL must use HTTPS");

    act(() => {
      result.current.handleWebhookInputChange("https://hooks.example.com/abc");
    });

    await act(async () => {
      await result.current.handleSaveWebhook();
    });

    expect(api.account.updateNotifications).toHaveBeenCalledWith({
      webhookUrl: "https://hooks.example.com/abc",
    });
    expect(result.current.webhookSuccess).toBe(true);

    await act(async () => {
      await result.current.handleRemoveWebhook();
    });

    expect(api.account.updateNotifications).toHaveBeenLastCalledWith({
      webhookUrl: null,
    });
    expect(result.current.webhookInput).toBe("");
  });

  it("clears crawl history and deletes the account", async () => {
    const mutateNotifications = vi.fn(async () => undefined);
    const mutateDigest = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGeneralSectionActions({
        mePersona: null,
        notifications: {
          notifyOnCrawlComplete: true,
          notifyOnScoreDrop: true,
          webhookUrl: null,
        },
        mutateNotifications,
        mutateDigest,
        projectsList: [{ id: "proj-1", name: "Marketing Site" }],
      }),
    );

    act(() => {
      result.current.setClearTarget("proj-1");
      result.current.setClearDialogOpen(true);
    });

    await act(async () => {
      await result.current.handleClearHistory();
    });

    expect(api.crawls.deleteHistory).toHaveBeenCalledWith("proj-1");
    expect(result.current.clearResult).toBe(
      "Deleted 2 crawls from Marketing Site.",
    );
    expect(result.current.clearDialogOpen).toBe(false);

    await act(async () => {
      await result.current.handleDeleteAccount();
    });

    expect(mockWithAuth).toHaveBeenCalledTimes(1);
    expect(api.account.deleteAccount).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
