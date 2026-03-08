import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: vi.fn(),
    delete: deleteMock,
  },
}));

import { createActionItemsApi } from "./action-items";
import { createAlertsApi } from "./alerts";
import { createNarrativesApi } from "./narratives";
import { createTrialApi } from "./trial";

describe("action-items/alerts/trial/narratives api domains", () => {
  const actionItemsApi = createActionItemsApi();
  const alertsApi = createAlertsApi();
  const trialApi = createTrialApi();
  const narrativesApi = createNarrativesApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates action items with the provided payload", async () => {
    postMock.mockResolvedValue({ data: { id: "item-1", title: "Fix title" } });

    const result = await actionItemsApi.create({
      projectId: "proj-1",
      issueCode: "MISSING_TITLE",
      title: "Fix title",
      status: "pending",
    });

    expect(postMock).toHaveBeenCalledWith("/api/action-items", {
      projectId: "proj-1",
      issueCode: "MISSING_TITLE",
      title: "Fix title",
      status: "pending",
    });
    expect(result).toEqual({ id: "item-1", title: "Fix title" });
  });

  it("loads action item stats by project id", async () => {
    getMock.mockResolvedValue({ data: { total: 4, fixed: 1, pending: 3 } });

    const result = await actionItemsApi.stats("proj-1");

    expect(getMock).toHaveBeenCalledWith(
      "/api/action-items/stats?projectId=proj-1",
    );
    expect(result).toEqual({ total: 4, fixed: 1, pending: 3 });
  });

  it("acknowledges all alerts for a project", async () => {
    postMock.mockResolvedValue({ data: { success: true } });

    const result = await alertsApi.acknowledgeAll("proj-1");

    expect(postMock).toHaveBeenCalledWith(
      "/api/alerts/acknowledge-all?projectId=proj-1",
      {},
    );
    expect(result).toEqual({ success: true });
  });

  it("starts a trial with an empty body", async () => {
    postMock.mockResolvedValue({
      data: {
        trialStartedAt: "2025-01-01T00:00:00.000Z",
        trialEndsAt: "2025-01-14T00:00:00.000Z",
        daysRemaining: 14,
      },
    });

    const result = await trialApi.start();

    expect(postMock).toHaveBeenCalledWith("/api/trial/start", {});
    expect(result).toEqual({
      trialStartedAt: "2025-01-01T00:00:00.000Z",
      trialEndsAt: "2025-01-14T00:00:00.000Z",
      daysRemaining: 14,
    });
  });

  it("loads narratives by crawl job id and tone", async () => {
    getMock.mockResolvedValue({ data: { summary: "Narrative" } });

    const result = await narrativesApi.get("crawl-1", "business");

    expect(getMock).toHaveBeenCalledWith(
      "/api/narratives/crawl-1?tone=business",
    );
    expect(result).toEqual({ summary: "Narrative" });
  });

  it("patches narrative sections with edited content", async () => {
    patchMock.mockResolvedValue({
      data: { sectionId: "intro", editedContent: "Updated" },
    });

    const result = await narrativesApi.editSection(
      "crawl-1",
      "intro",
      "Updated",
    );

    expect(patchMock).toHaveBeenCalledWith(
      "/api/narratives/crawl-1/sections/intro",
      { editedContent: "Updated" },
    );
    expect(result).toEqual({ sectionId: "intro", editedContent: "Updated" });
  });

  it("deletes narratives by crawl job id", async () => {
    deleteMock.mockResolvedValue({ data: { deleted: true } });

    const result = await narrativesApi.delete("crawl-1");

    expect(deleteMock).toHaveBeenCalledWith("/api/narratives/crawl-1");
    expect(result).toEqual({ deleted: true });
  });
});
