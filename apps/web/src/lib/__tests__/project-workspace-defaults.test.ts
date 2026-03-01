import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProjectUpdate = vi.fn();
const mockPipelineUpdate = vi.fn();
const mockVisibilityScheduleCreate = vi.fn();
const mockGetDigestPreferences = vi.fn();
const mockUpdateDigestPreferences = vi.fn();

vi.mock("../api", () => ({
  api: {
    projects: {
      update: (...args: unknown[]) => mockProjectUpdate(...args),
    },
    pipeline: {
      updateSettings: (...args: unknown[]) => mockPipelineUpdate(...args),
    },
    visibility: {
      schedules: {
        create: (...args: unknown[]) => mockVisibilityScheduleCreate(...args),
      },
    },
    account: {
      getDigestPreferences: (...args: unknown[]) =>
        mockGetDigestPreferences(...args),
      updateDigestPreferences: (...args: unknown[]) =>
        mockUpdateDigestPreferences(...args),
    },
  },
}));

import { applyProjectWorkspaceDefaults } from "../project-workspace-defaults";

describe("applyProjectWorkspaceDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectUpdate.mockResolvedValue({});
    mockPipelineUpdate.mockResolvedValue({});
    mockVisibilityScheduleCreate.mockResolvedValue({});
    mockGetDigestPreferences.mockResolvedValue({
      digestFrequency: "off",
      digestDay: 1,
      lastDigestSentAt: null,
    });
    mockUpdateDigestPreferences.mockResolvedValue({
      digestFrequency: "weekly",
      digestDay: 1,
      lastDigestSentAt: null,
    });
  });

  it("applies recommended defaults for new workspace creation", async () => {
    const result = await applyProjectWorkspaceDefaults({
      projectId: "proj-1",
      domainOrUrl: "https://example.com",
      title: "Example",
    });

    expect(mockProjectUpdate).toHaveBeenCalledWith("proj-1", {
      settings: { schedule: "weekly" },
    });
    expect(mockPipelineUpdate).toHaveBeenCalledWith("proj-1", {
      autoRunOnCrawl: true,
    });
    expect(mockVisibilityScheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        frequency: "weekly",
      }),
    );
    expect(mockUpdateDigestPreferences).toHaveBeenCalledWith({
      digestFrequency: "weekly",
      digestDay: 1,
    });
    expect(result.failed).toEqual([]);
    expect(result.digestEnabled).toBe(true);
  });

  it("respects explicit defaults overrides", async () => {
    await applyProjectWorkspaceDefaults({
      projectId: "proj-2",
      domainOrUrl: "https://example.com",
      defaults: {
        schedule: "manual",
        autoRunOnCrawl: false,
        enableVisibilitySchedule: false,
        enableWeeklyDigest: false,
      },
    });

    expect(mockProjectUpdate).toHaveBeenCalledWith("proj-2", {
      settings: { schedule: "manual" },
    });
    expect(mockPipelineUpdate).toHaveBeenCalledWith("proj-2", {
      autoRunOnCrawl: false,
    });
    expect(mockVisibilityScheduleCreate).not.toHaveBeenCalled();
    expect(mockGetDigestPreferences).not.toHaveBeenCalled();
    expect(mockUpdateDigestPreferences).not.toHaveBeenCalled();
  });
});
