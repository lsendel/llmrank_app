import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useApiTokensSectionState } from "./use-api-tokens-section-state";

const { mockWithAuth, mockUseApiSWR, mockMutateTokens } = vi.hoisted(() => ({
  mockWithAuth: vi.fn((callback: () => Promise<unknown> | unknown) =>
    callback(),
  ),
  mockUseApiSWR: vi.fn(),
  mockMutateTokens: vi.fn(async () => undefined),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

describe("useApiTokensSectionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApiSWR.mockImplementation((key: string) => {
      if (key === "billing-info") {
        return { data: { plan: "pro" } };
      }

      if (key === "api-tokens") {
        return {
          data: [
            {
              id: "tok-1",
              name: "Primary token",
              prefix: "llmb",
              type: "api",
              scopes: ["metrics:read"],
              projectId: null,
              lastUsedAt: null,
              createdAt: "2026-03-07T12:00:00.000Z",
              expiresAt: null,
            },
          ],
          mutate: mockMutateTokens,
        };
      }

      if (key === "projects-for-tokens") {
        return {
          data: {
            data: [
              {
                id: "proj-1",
                name: "Main Site",
                domain: "https://example.com",
              },
            ],
          },
        };
      }

      return {};
    });

    api.tokens.create = vi.fn(async () => ({
      id: "tok-created",
      name: "CI token",
      prefix: "llmb",
      type: "api",
      scopes: ["metrics:read"],
      projectId: "proj-1",
      lastUsedAt: null,
      createdAt: "2026-03-07T12:00:00.000Z",
      expiresAt: null,
      plaintext: "tok_live_created",
    }));
    api.tokens.revoke = vi.fn(async () => undefined);
    api.billing.createCheckoutSession = vi.fn(async () => ({
      url: "https://billing.example.com/checkout",
    }));
  });

  it("derives plan state and resets dialog inputs", async () => {
    const { result } = renderHook(() => useApiTokensSectionState());

    await waitFor(() => {
      expect(result.current.canUseTokens).toBe(true);
      expect(result.current.maxTokens).toBe(5);
      expect(result.current.tokens).toHaveLength(1);
      expect(result.current.projects).toHaveLength(1);
    });

    act(() => {
      result.current.handleCreateTokenDialogOpenChange(true);
      result.current.handleTokenNameChange("Temporary token");
      result.current.handleTokenTypeChange("api");
      result.current.setTokenProjectId("proj-1");
    });

    expect(result.current.createTokenOpen).toBe(true);
    expect(result.current.tokenName).toBe("Temporary token");

    act(() => {
      result.current.handleCreateTokenDialogOpenChange(false);
    });

    expect(result.current.createTokenOpen).toBe(false);
    expect(result.current.tokenName).toBe("");
    expect(result.current.tokenType).toBe("mcp");
    expect(result.current.tokenProjectId).toBe("");
  });

  it("validates, creates, and revokes tokens", async () => {
    const { result } = renderHook(() => useApiTokensSectionState());

    await act(async () => {
      await result.current.handleCreateToken();
    });

    expect(result.current.tokenError).toBe("Token name is required.");

    act(() => {
      result.current.handleTokenTypeChange("api");
      result.current.handleTokenNameChange("CI token");
      result.current.setTokenProjectId("proj-1");
    });

    await act(async () => {
      await result.current.handleCreateToken();
    });

    expect(api.tokens.create).toHaveBeenCalledWith({
      name: "CI token",
      type: "api",
      projectId: "proj-1",
      scopes: ["metrics:read"],
    });
    expect(mockMutateTokens).toHaveBeenCalledTimes(1);
    expect(result.current.createdToken?.plaintext).toBe("tok_live_created");

    act(() => {
      result.current.handleRevokeDialogOpenChange(true, "tok-1");
    });

    expect(result.current.revokeTokenId).toBe("tok-1");

    await act(async () => {
      await result.current.handleRevokeToken("tok-1");
    });

    expect(api.tokens.revoke).toHaveBeenCalledWith("tok-1");
    expect(mockMutateTokens).toHaveBeenCalledTimes(2);
    expect(result.current.revokeTokenId).toBeNull();
  });
});
