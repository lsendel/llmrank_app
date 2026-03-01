import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject } from "../helpers/factories";

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

const mockActionItems = {
  listByProject: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  getOpenByProjectIssueCode: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(null),
  updateStatus: vi.fn().mockResolvedValue(null),
  getStats: vi.fn().mockResolvedValue({
    total: 0,
    fixed: 0,
    inProgress: 0,
    dismissed: 0,
    pending: 0,
    fixRate: 0,
  }),
};

const mockProjects = {
  getById: vi.fn().mockResolvedValue(null),
};

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    actionItemQueries: () => mockActionItems,
    projectQueries: () => mockProjects,
  };
});

vi.mock("../../repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

describe("Action Item Routes", () => {
  const { request } = createTestApp();
  const projectId = "11111111-1111-1111-1111-111111111111";
  const actionId = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects.getById.mockResolvedValue(
      buildProject({ id: projectId, userId: "test-user-id" }),
    );
  });

  it("creates a manual action item with due date", async () => {
    mockActionItems.create.mockResolvedValue({
      id: actionId,
      projectId,
      issueCode: "MISSING_META_DESC",
      status: "pending",
      severity: "warning",
      category: "technical",
      scoreImpact: 8,
      title: "Meta description missing",
      description: "Add 140-160 chars",
      assigneeId: "test-user-id",
      dueAt: "2026-03-15T00:00:00.000Z",
      verifiedAt: null,
      verifiedByCrawlId: null,
      createdAt: "2026-02-28T00:00:00.000Z",
      updatedAt: "2026-02-28T00:00:00.000Z",
    });

    const res = await request("/api/action-items", {
      method: "POST",
      json: {
        projectId,
        issueCode: "missing_meta_desc",
        title: "Meta description missing",
        severity: "warning",
        category: "technical",
        scoreImpact: 8,
        description: "Add 140-160 chars",
        assigneeId: "test-user-id",
        dueAt: "2026-03-15T00:00:00.000Z",
      },
    });

    expect(res.status).toBe(201);
    expect(mockActionItems.create).toHaveBeenCalledWith(
      expect.objectContaining({
        issueCode: "MISSING_META_DESC",
        assigneeId: "test-user-id",
        dueAt: expect.any(Date),
      }),
    );
  });

  it("dedupes to existing open action item and updates assignment fields", async () => {
    mockActionItems.getOpenByProjectIssueCode.mockResolvedValue({
      id: actionId,
      projectId,
      issueCode: "MISSING_META_DESC",
      status: "pending",
      assigneeId: null,
      dueAt: null,
    });
    mockActionItems.update.mockResolvedValue({
      id: actionId,
      assigneeId: "test-user-id",
      dueAt: "2026-03-10T00:00:00.000Z",
    });

    const res = await request("/api/action-items", {
      method: "POST",
      json: {
        projectId,
        issueCode: "missing_meta_desc",
        title: "Meta description missing",
        assigneeId: "test-user-id",
        dueAt: "2026-03-10T00:00:00.000Z",
      },
    });

    expect(res.status).toBe(200);
    expect(mockActionItems.create).not.toHaveBeenCalled();
    expect(mockActionItems.update).toHaveBeenCalledWith(
      actionId,
      expect.objectContaining({
        assigneeId: "test-user-id",
        dueAt: expect.any(Date),
      }),
    );
  });

  it("returns 422 for invalid dueAt on create", async () => {
    const res = await request("/api/action-items", {
      method: "POST",
      json: {
        projectId,
        issueCode: "MISSING_META_DESC",
        title: "Meta description missing",
        dueAt: "not-a-date",
      },
    });
    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates assignee/dueAt/status on PATCH /:id", async () => {
    mockActionItems.getById.mockResolvedValue({
      id: actionId,
      projectId,
      status: "pending",
    });
    mockActionItems.update.mockResolvedValue({
      id: actionId,
      projectId,
      status: "in_progress",
      assigneeId: "test-user-id",
      dueAt: "2026-03-20T00:00:00.000Z",
    });

    const res = await request(`/api/action-items/${actionId}`, {
      method: "PATCH",
      json: {
        status: "in_progress",
        assigneeId: "test-user-id",
        dueAt: "2026-03-20T00:00:00.000Z",
      },
    });
    expect(res.status).toBe(200);
    expect(mockActionItems.update).toHaveBeenCalledWith(
      actionId,
      expect.objectContaining({
        status: "in_progress",
        assigneeId: "test-user-id",
        dueAt: expect.any(Date),
      }),
    );
  });

  it("lists action items for a project", async () => {
    mockActionItems.listByProject.mockResolvedValue([
      {
        id: actionId,
        projectId,
        issueCode: "MISSING_META_DESC",
        status: "pending",
      },
    ]);

    const res = await request(`/api/action-items?projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(mockActionItems.listByProject).toHaveBeenCalledWith(projectId);

    const body: any = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(actionId);
  });

  it("updates status on PATCH /:id/status", async () => {
    mockActionItems.getById.mockResolvedValue({
      id: actionId,
      projectId,
      status: "pending",
    });
    mockActionItems.updateStatus.mockResolvedValue({
      id: actionId,
      projectId,
      status: "fixed",
    });

    const res = await request(`/api/action-items/${actionId}/status`, {
      method: "PATCH",
      json: { status: "fixed" },
    });
    expect(res.status).toBe(200);
    expect(mockActionItems.updateStatus).toHaveBeenCalledWith(
      actionId,
      "fixed",
    );
  });

  it("returns stats for project action items", async () => {
    mockActionItems.getStats.mockResolvedValue({
      total: 6,
      fixed: 2,
      inProgress: 1,
      dismissed: 1,
      pending: 2,
      fixRate: 33,
    });

    const res = await request(`/api/action-items/stats?projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(mockActionItems.getStats).toHaveBeenCalledWith(projectId);

    const body: any = await res.json();
    expect(body.data.total).toBe(6);
    expect(body.data.fixRate).toBe(33);
  });

  it("supports legacy /api/action-plan alias", async () => {
    mockActionItems.listByProject.mockResolvedValue([
      { id: actionId, projectId, issueCode: "MISSING_META_DESC" },
    ]);

    const res = await request(`/api/action-plan?projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(mockActionItems.listByProject).toHaveBeenCalledWith(projectId);
    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Link")).toContain("/api/action-items");
  });
});
