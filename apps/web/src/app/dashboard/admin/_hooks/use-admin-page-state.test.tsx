import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type AdminIngestDetails,
  type AdminStats,
  type Promo,
} from "@/lib/api";
import { useAdminPageState } from "./use-admin-page-state";

const { mockUseApiSWR, mockWithAuth, mockRefreshIngest, mockRefreshPromos } =
  vi.hoisted(() => ({
    mockUseApiSWR: vi.fn(),
    mockWithAuth: vi.fn((callback: () => Promise<unknown> | unknown) =>
      callback(),
    ),
    mockRefreshIngest: vi.fn(async () => undefined),
    mockRefreshPromos: vi.fn(async () => undefined),
  }));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: mockUseApiSWR,
}));

const stats: AdminStats = {
  mrr: 1250,
  mrrByPlan: { pro: 1250 },
  totalRevenue: 9800,
  failedPayments: 1,
  activeSubscribers: 14,
  totalCustomers: 20,
  churnRate: 3.5,
  ingestHealth: {
    pendingJobs: 12,
    runningJobs: 2,
    failedLast24h: 1,
    avgCompletionMinutes: 18.5,
    outboxPending: 3,
  },
};

const ingestDetails: AdminIngestDetails = {
  pendingJobs: [],
  runningJobs: [],
  failedJobs: [],
  outboxEvents: [],
};

const promos: Promo[] = [];

describe("useAdminPageState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "admin-stats") {
        return { data: stats, error: undefined };
      }
      if (key === "admin-metrics") {
        return {
          data: {
            activeCrawls: 3,
            errorsLast24h: 1,
            systemTime: "2024-03-10T10:00:00.000Z",
          },
        };
      }
      if (key === "admin-ingest-details") {
        return { data: ingestDetails, mutate: mockRefreshIngest };
      }
      if (key === "admin-promos") {
        return { data: promos, mutate: mockRefreshPromos };
      }
      if (typeof key === "string" && key.startsWith("admin-customers")) {
        return {
          data: {
            data: [
              {
                id: "user_1",
                email: "alice@example.com",
                name: "Alice",
                plan: "starter",
                stripeCustomerId: "cus_1",
                createdAt: "2024-03-10T00:00:00.000Z",
              },
            ],
          },
          isLoading: false,
        };
      }

      return {
        data: undefined,
        isLoading: false,
        mutate: vi.fn(async () => undefined),
      };
    });

    api.admin.getBlockedDomains = vi.fn(async () => [
      {
        id: "blocked_1",
        domain: "blocked.example.com",
        reason: "Spam",
        blockedBy: "admin",
        createdAt: "2024-03-10T00:00:00.000Z",
      },
    ]);
    api.admin.getSettings = vi.fn(async () => ({
      http_fallback_enabled: true,
    }));
    api.admin.cancelCrawlJob = vi.fn(async () => undefined);
    api.admin.changeUserPlan = vi.fn(async () => undefined);
    api.admin.createPromo = vi.fn(async () => ({
      id: "promo_1",
      code: "SAVE20",
      stripeCouponId: "coupon_1",
      discountType: "percent_off",
      discountValue: 20,
      duration: "once",
      durationMonths: null,
      maxRedemptions: null,
      timesRedeemed: 0,
      expiresAt: null,
      active: true,
      createdAt: "2024-03-10T00:00:00.000Z",
    }));
    api.admin.addBlockedDomain = vi.fn(
      async (domain: string, reason?: string) => ({
        id: "blocked_2",
        domain,
        reason: reason ?? null,
        blockedBy: "admin",
        createdAt: "2024-03-10T00:00:00.000Z",
      }),
    );
    api.admin.removeBlockedDomain = vi.fn(async () => ({
      id: "blocked_2",
      domain: "example.com",
      reason: null,
      blockedBy: "admin",
      createdAt: "2024-03-10T00:00:00.000Z",
    }));
    api.admin.updateSetting = vi.fn(async () => undefined);
  });

  it("loads derived admin data and mount-side admin settings", async () => {
    const { result } = renderHook(() => useAdminPageState());

    await waitFor(() => expect(result.current.blockedDomains).toHaveLength(1));

    expect(result.current.accessDenied).toBe(false);
    expect(result.current.customers[0]?.email).toBe("alice@example.com");
    expect(result.current.httpFallbackEnabled).toBe(true);
    expect(result.current.statCards[0]?.value).toBe("$1,250.00");
    expect(result.current.ingestCards).toHaveLength(5);
  });

  it("confirms a cancel-job dialog with a trimmed reason and refreshes ingest details", async () => {
    const { result } = renderHook(() => useAdminPageState());

    await waitFor(() => expect(result.current.httpFallbackEnabled).toBe(true));

    act(() => {
      result.current.openCancelDialog("job_1", "Marketing Site");
      result.current.setCancelReason("  Manual admin stop  ");
    });

    await act(async () => {
      await result.current.handleConfirmCancelJob();
    });

    expect(api.admin.cancelCrawlJob).toHaveBeenCalledWith(
      "job_1",
      "Manual admin stop",
    );
    expect(mockRefreshIngest).toHaveBeenCalledTimes(1);
    expect(result.current.cancelDialog).toBeNull();
  });

  it("runs customer plan changes and resets the dialog state", async () => {
    const { result } = renderHook(() => useAdminPageState());

    await waitFor(() => expect(result.current.customers).toHaveLength(1));

    act(() => {
      result.current.openCustomerActionDialog(
        { userId: "user_1", name: "Alice", action: "change-plan" },
        "pro",
      );
      result.current.setActionReason("unused");
    });

    expect(result.current.selectedPlan).toBe("pro");

    await act(async () => {
      await result.current.handleCustomerAction();
    });

    expect(api.admin.changeUserPlan).toHaveBeenCalledWith("user_1", "pro");
    expect(result.current.customerActionDialog).toBeNull();
    expect(result.current.actionReason).toBe("");
  });

  it("creates promos, normalizes blocked domains, and toggles HTTP fallback", async () => {
    const { result } = renderHook(() => useAdminPageState());

    await waitFor(() => expect(result.current.httpFallbackEnabled).toBe(true));

    act(() => {
      result.current.setShowCreatePromo(true);
      result.current.updateNewPromo({
        code: "SAVE20",
        discountType: "percent_off",
        discountValue: 20,
        duration: "once",
      });
    });

    await act(async () => {
      await result.current.handleCreatePromo();
    });

    expect(api.admin.createPromo).toHaveBeenCalledWith({
      code: "SAVE20",
      discountType: "percent_off",
      discountValue: 20,
      duration: "once",
      durationMonths: undefined,
      maxRedemptions: undefined,
      expiresAt: undefined,
    });
    expect(mockRefreshPromos).toHaveBeenCalledTimes(1);
    expect(result.current.showCreatePromo).toBe(false);
    expect(result.current.newPromo.code).toBe("");

    act(() => {
      result.current.setNewBlockDomain(" HTTPS://WWW.Example.COM/path ");
      result.current.setNewBlockReason("Spam");
    });

    await act(async () => {
      await result.current.handleAddBlocked();
    });

    expect(api.admin.addBlockedDomain).toHaveBeenCalledWith(
      "example.com",
      "Spam",
    );
    expect(result.current.newBlockDomain).toBe("");
    expect(result.current.newBlockReason).toBe("");
    expect(
      result.current.blockedDomains.some(
        (domain) => domain.domain === "example.com",
      ),
    ).toBe(true);

    await act(async () => {
      await result.current.handleToggleHttpFallback();
    });

    expect(api.admin.updateSetting).toHaveBeenCalledWith(
      "http_fallback_enabled",
      false,
    );
    expect(result.current.httpFallbackEnabled).toBe(false);
  });
});
