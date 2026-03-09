import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useBillingPageState } from "./use-billing-page-state";

const {
  mockUseApiSWR,
  mockWithAuth,
  mockToast,
  mockReplace,
  mockSearchParamsGet,
  mockMutateSubscription,
  mockMutateBilling,
} = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
  mockWithAuth: vi.fn((callback: () => Promise<unknown> | unknown) =>
    callback(),
  ),
  mockToast: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParamsGet: vi.fn(() => null),
  mockMutateSubscription: vi.fn(async () => undefined),
  mockMutateBilling: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: mockUseApiSWR,
}));

describe("useBillingPageState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);

    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "billing-info") {
        return {
          data: {
            plan: "starter",
            crawlCreditsRemaining: 7,
            crawlCreditsTotal: 10,
            maxPagesPerCrawl: 100,
            maxDepth: 3,
            maxProjects: 5,
          },
          mutate: mockMutateBilling,
        };
      }

      if (key === "billing-subscription") {
        return {
          data: {
            id: "sub_1",
            planCode: "starter",
            status: "active",
            currentPeriodEnd: "2024-04-10T00:00:00.000Z",
            cancelAtPeriodEnd: false,
            canceledAt: null,
          },
          mutate: mockMutateSubscription,
        };
      }

      if (key === "billing-payments") {
        return {
          data: [],
          mutate: vi.fn(async () => undefined),
        };
      }

      return { data: undefined, mutate: vi.fn(async () => undefined) };
    });

    api.billing.getInfo = vi.fn(async () => ({
      plan: "starter",
      crawlCreditsRemaining: 7,
      crawlCreditsTotal: 10,
      maxPagesPerCrawl: 100,
      maxDepth: 3,
      maxProjects: 5,
    }));
    api.billing.upgrade = vi.fn(async () => ({
      upgraded: true,
      targetPlan: "pro",
      method: "checkout",
      url: "https://stripe.test/checkout",
    }));
    api.billing.downgrade = vi.fn(async () => ({ downgraded: true }));
    api.billing.cancelSubscription = vi.fn(async () => undefined);
    api.billing.validatePromo = vi.fn(async () => ({
      code: "SAVE20",
      discountType: "percent_off",
      discountValue: 20,
      duration: "once",
      durationMonths: null,
    }));
    api.billing.createPortalSession = vi.fn(async () => ({
      url: "https://stripe.test/portal",
    }));
  });

  it("opens the downgrade dialog instead of upgrading when selecting a lower tier", async () => {
    const { result } = renderHook(() => useBillingPageState());

    await act(async () => {
      await result.current.handlePlanAction("free");
    });

    expect(result.current.downgradeDialogOpen).toBe(true);
    expect(result.current.downgradingTo).toBeNull();
    expect(api.billing.upgrade).not.toHaveBeenCalled();
  });

  it("validates promo codes and clears stale promo state on input changes", async () => {
    const { result } = renderHook(() => useBillingPageState());

    act(() => {
      result.current.handlePromoCodeChange("SAVE20");
    });

    await act(async () => {
      await result.current.handleValidatePromo();
    });

    expect(api.billing.validatePromo).toHaveBeenCalledWith("SAVE20");
    expect(result.current.promoValid?.code).toBe("SAVE20");
    expect(result.current.promoError).toBeNull();

    act(() => {
      result.current.handlePromoCodeChange("NEWCODE");
    });

    expect(result.current.promoValid).toBeNull();
    expect(result.current.promoError).toBeNull();
  });
});
