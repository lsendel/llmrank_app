import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useScoringProfileSectionState } from "./use-scoring-profile-section-state";

const { mockUseApiSWR, mockMutate, mockToast } = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
  mockMutate: vi.fn(async () => undefined),
  mockToast: vi.fn(),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("useScoringProfileSectionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApiSWR.mockReturnValue({
      data: [
        {
          id: "profile-1",
          name: "Default",
          weights: {
            technical: 25,
            content: 30,
            aiReadiness: 30,
            performance: 15,
          },
          disabledFactors: [],
          isDefault: true,
          createdAt: "2026-03-07T12:00:00.000Z",
        },
      ],
      mutate: mockMutate,
    });

    api.scoringProfiles.create = vi.fn(async () => ({
      id: "profile-created",
      name: "Custom Profile",
      weights: { technical: 35, content: 30, aiReadiness: 20, performance: 15 },
      disabledFactors: [],
      isDefault: true,
      createdAt: "2026-03-07T12:00:00.000Z",
    }));
    api.scoringProfiles.update = vi.fn(async () => ({
      id: "profile-1",
      name: "E-commerce",
      weights: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
      disabledFactors: [],
      isDefault: true,
      createdAt: "2026-03-07T12:00:00.000Z",
    }));
  });

  it("switches presets and custom editor state", async () => {
    const { result } = renderHook(() => useScoringProfileSectionState());

    await waitFor(() => {
      expect(result.current.total).toBe(100);
      expect(result.current.isValid).toBe(true);
      expect(result.current.preset).toBe("default");
    });

    act(() => {
      result.current.handlePresetChange("ecommerce");
    });

    expect(result.current.weights).toEqual({
      technical: 30,
      content: 20,
      aiReadiness: 35,
      performance: 15,
    });
    expect(result.current.showCustomEditor).toBe(false);

    act(() => {
      result.current.handleToggleCustomEditor();
      result.current.handleWeightChange("technical", 35);
    });

    expect(result.current.preset).toBe("custom");
    expect(result.current.showCustomEditor).toBe(true);
    expect(result.current.isValid).toBe(false);
    expect(result.current.total).toBe(105);
  });

  it("updates the existing default scoring profile", async () => {
    const { result } = renderHook(() => useScoringProfileSectionState());

    act(() => {
      result.current.handlePresetChange("ecommerce");
    });

    await waitFor(() => {
      expect(result.current.preset).toBe("ecommerce");
      expect(result.current.weights).toEqual({
        technical: 30,
        content: 20,
        aiReadiness: 35,
        performance: 15,
      });
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(api.scoringProfiles.update).toHaveBeenCalledWith("profile-1", {
      name: "E-commerce",
      weights: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({ title: "Scoring profile saved" });
    expect(api.scoringProfiles.create).not.toHaveBeenCalled();
  });
});
