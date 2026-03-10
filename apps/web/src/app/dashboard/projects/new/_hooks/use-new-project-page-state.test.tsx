import type { FormEvent } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNewProjectPageState } from "./use-new-project-page-state";

const {
  mockPush,
  mockBack,
  getDigestPreferencesMock,
  createProjectMock,
  startCrawlMock,
  applyProjectWorkspaceDefaultsMock,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockBack: vi.fn(),
  getDigestPreferencesMock: vi.fn(),
  createProjectMock: vi.fn(),
  startCrawlMock: vi.fn(),
  applyProjectWorkspaceDefaultsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
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
    ApiError,
    api: {
      account: {
        getDigestPreferences: getDigestPreferencesMock,
      },
      projects: {
        create: createProjectMock,
      },
      crawls: {
        start: startCrawlMock,
      },
    },
  };
});

vi.mock("@/lib/project-workspace-defaults", () => ({
  applyProjectWorkspaceDefaults: applyProjectWorkspaceDefaultsMock,
}));

describe("useNewProjectPageState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDigestPreferencesMock.mockResolvedValue({ digestFrequency: "weekly" });
    createProjectMock.mockResolvedValue({ id: "proj-1" });
    startCrawlMock.mockResolvedValue({ id: "crawl-1" });
    applyProjectWorkspaceDefaultsMock.mockResolvedValue({
      failed: [],
      digestEnabled: false,
    });
  });

  it("enables weekly digest when the current account digest is off", async () => {
    getDigestPreferencesMock.mockResolvedValue({ digestFrequency: "off" });

    const { result } = renderHook(() => useNewProjectPageState());

    await waitFor(() => {
      expect(result.current.enableWeeklyDigest).toBe(true);
    });
  });

  it("validates required fields before creating a project", async () => {
    const { result } = renderHook(() => useNewProjectPageState());

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as FormEvent<HTMLFormElement>);
    });

    expect(result.current.errors).toEqual({
      name: "Name is required and must be 100 characters or fewer.",
      domain: "Domain is required.",
    });
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("creates a project, applies defaults, and starts the first crawl", async () => {
    const { result } = renderHook(() => useNewProjectPageState());

    act(() => {
      result.current.setName("Marketing Site");
      result.current.setDomain("https://www.example.com/path");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as FormEvent<HTMLFormElement>);
    });

    expect(createProjectMock).toHaveBeenCalledWith({
      name: "Marketing Site",
      domain: "example.com",
    });
    expect(applyProjectWorkspaceDefaultsMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      domainOrUrl: "example.com",
      defaults: {
        schedule: "weekly",
        autoRunOnCrawl: true,
        enableVisibilitySchedule: true,
        enableWeeklyDigest: false,
      },
    });
    expect(startCrawlMock).toHaveBeenCalledWith("proj-1");
    expect(mockPush).toHaveBeenCalledWith("/dashboard/crawl/crawl-1");
  });

  it("redirects to the project page without auto-start and surfaces API errors", async () => {
    const { ApiError } = await import("@/lib/api");
    const { result, rerender } = renderHook(() => useNewProjectPageState());

    act(() => {
      result.current.setName("Manual Setup");
      result.current.setDomain("example.com");
      result.current.setAutoStartCrawl(false);
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as FormEvent<HTMLFormElement>);
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/projects/proj-1");

    createProjectMock.mockRejectedValueOnce(
      new ApiError(403, "PLAN_LIMIT_REACHED", "Upgrade required"),
    );

    rerender();

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as FormEvent<HTMLFormElement>);
    });

    expect(result.current.errors.form).toBe("Upgrade required");
    expect(result.current.submitting).toBe(false);
  });
});
