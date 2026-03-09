import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsPageState } from "./use-settings-page-state";

const {
  mockFetch,
  mockReplace,
  mockSearchParamsGet,
  mockSearchParamsToString,
  searchParamState,
} = vi.hoisted(() => {
  const state = { value: "" };

  return {
    mockFetch: vi.fn(),
    mockReplace: vi.fn(),
    mockSearchParamsGet: vi.fn((key: string) =>
      new URLSearchParams(state.value).get(key),
    ),
    mockSearchParamsToString: vi.fn(() => state.value),
    searchParamState: state,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard/settings",
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
}));

vi.mock("@/lib/api-base-url", () => ({
  apiUrl: (path: string) => `https://api.test${path}`,
}));

vi.stubGlobal("fetch", mockFetch);

describe("useSettingsPageState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamState.value = "";
  });

  it("normalizes org-only tabs when organization access is unavailable", async () => {
    searchParamState.value = "tab=sso";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });

    const { result } = renderHook(() => useSettingsPageState());

    await waitFor(() => {
      expect(result.current.activeTab).toBe("general");
    });

    expect(mockFetch).toHaveBeenCalledWith("https://api.test/api/orgs", {
      credentials: "include",
    });
    expect(mockReplace).toHaveBeenCalledWith("/dashboard/settings", {
      scroll: false,
    });
  });

  it("removes the tab param when switching back to the default tab", async () => {
    searchParamState.value = "foo=bar&tab=notifications";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "org_123" } }),
    });

    const { result } = renderHook(() => useSettingsPageState());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.handleTabChange("general");
    });

    expect(mockReplace).toHaveBeenLastCalledWith(
      "/dashboard/settings?foo=bar",
      {
        scroll: false,
      },
    );
  });

  it("surfaces organization load errors and retries successfully", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "org_retry" } }),
      });

    const { result } = renderHook(() => useSettingsPageState());

    await waitFor(() => {
      expect(result.current.orgLoadError).toBe(true);
    });

    act(() => {
      result.current.retryLoadOrganization();
    });

    await waitFor(() => {
      expect(result.current.orgLoadError).toBe(false);
      expect(result.current.orgId).toBe("org_retry");
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
