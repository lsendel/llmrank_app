import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogService } from "../../services/log-service";
import {
  createMockLogRepo,
  createMockProjectRepo,
} from "../helpers/mock-repositories";
import { buildProject } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@llm-boost/shared", async () => {
  const actual =
    await vi.importActual<typeof import("@llm-boost/shared")>(
      "@llm-boost/shared",
    );
  return {
    ...actual,
    parseLogLine: vi.fn().mockImplementation((line: string) => {
      if (line.startsWith("INVALID")) return null;
      return {
        ip: "1.2.3.4",
        timestamp: "2024-01-01T00:00:00Z",
        method: "GET",
        path: "/",
        status: 200,
        userAgent: "TestBot/1.0",
      };
    }),
    summarizeLogs: vi.fn().mockReturnValue({
      totalRequests: 5,
      crawlerRequests: 2,
      uniqueIPs: 3,
    }),
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LogService", () => {
  let logs: ReturnType<typeof createMockLogRepo>;
  let projects: ReturnType<typeof createMockProjectRepo>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish parseLogLine implementation after clearAllMocks
    const shared = await import("@llm-boost/shared");
    (shared.parseLogLine as ReturnType<typeof vi.fn>).mockImplementation(
      (line: string) => {
        if (line.startsWith("INVALID")) return null;
        return {
          ip: "1.2.3.4",
          timestamp: "2024-01-01T00:00:00Z",
          method: "GET",
          path: "/",
          status: 200,
          userAgent: "TestBot/1.0",
        };
      },
    );
    (shared.summarizeLogs as ReturnType<typeof vi.fn>).mockReturnValue({
      totalRequests: 5,
      crawlerRequests: 2,
      uniqueIPs: 3,
    });
    logs = createMockLogRepo({
      create: vi.fn().mockResolvedValue({
        id: "log-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-1",
        projectId: "proj-1",
        filename: "test.log",
        summary: {},
        totalRequests: 0,
        crawlerRequests: 0,
        uniqueIPs: 0,
        domain: "example.com",
        settings: {},
        branding: {},
        crawlSchedule: "manual",
        nextCrawlAt: null,
        deletedAt: null,
        name: "test",
      }),
    });
    projects = createMockProjectRepo({
      getById: vi.fn().mockResolvedValue(buildProject()),
    });
  });

  describe("upload", () => {
    it("parses and stores log file with summary", async () => {
      const service = createLogService({ logs, projects });
      const result = await service.upload("user-1", "proj-1", {
        filename: "access.log",
        content: "line1\nline2\nline3",
      });

      expect(result.id).toBe("log-1");
      expect(result.summary).toEqual({
        totalRequests: 5,
        crawlerRequests: 2,
        uniqueIPs: 3,
      });
      expect(logs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          userId: "user-1",
          filename: "access.log",
          totalRequests: 5,
          crawlerRequests: 2,
          uniqueIPs: 3,
        }),
      );
    });

    it("throws when filename is missing", async () => {
      const service = createLogService({ logs, projects });
      await expect(
        service.upload("user-1", "proj-1", { filename: "", content: "data" }),
      ).rejects.toThrow("filename and content required");
    });

    it("throws when content is missing", async () => {
      const service = createLogService({ logs, projects });
      await expect(
        service.upload("user-1", "proj-1", {
          filename: "file.log",
          content: "",
        }),
      ).rejects.toThrow("filename and content required");
    });

    it("throws when no valid log entries are found", async () => {
      const { parseLogLine } = await import("@llm-boost/shared");
      (parseLogLine as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const service = createLogService({ logs, projects });
      await expect(
        service.upload("user-1", "proj-1", {
          filename: "bad.log",
          content: "INVALID\nINVALID",
        }),
      ).rejects.toThrow("No valid log entries found");
    });

    it("throws NOT_FOUND when project does not belong to user", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createLogService({ logs, projects });

      await expect(
        service.upload("user-1", "proj-1", {
          filename: "test.log",
          content: "line1",
        }),
      ).rejects.toThrow("Resource does not exist");
    });

    it("throws NOT_FOUND when project does not exist", async () => {
      projects.getById.mockResolvedValue(undefined);
      const service = createLogService({ logs, projects });

      await expect(
        service.upload("user-1", "proj-1", {
          filename: "test.log",
          content: "line1",
        }),
      ).rejects.toThrow("Resource does not exist");
    });

    it("filters blank lines from content", async () => {
      const service = createLogService({ logs, projects });
      // Content with blank lines between valid entries should still succeed
      const result = await service.upload("user-1", "proj-1", {
        filename: "gaps.log",
        content: "line1\n\n  \nline2\n",
      });

      // Upload should succeed because non-blank lines produce valid entries
      expect(result).toHaveProperty("id");
      expect(logs.create).toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns logs for owned project", async () => {
      const mockLogs = [
        {
          id: "log-1",
          filename: "access.log",
          createdAt: new Date(),
          userId: "user-1",
          projectId: "proj-1",
          summary: {},
          totalRequests: 5,
          crawlerRequests: 2,
          uniqueIPs: 3,
        },
      ];
      logs.listByProject.mockResolvedValue(mockLogs);
      const service = createLogService({ logs, projects });

      const result = await service.list("user-1", "proj-1");
      expect(result).toEqual(mockLogs);
      expect(logs.listByProject).toHaveBeenCalledWith("proj-1");
    });

    it("throws NOT_FOUND when project not owned", async () => {
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createLogService({ logs, projects });

      await expect(service.list("user-1", "proj-1")).rejects.toThrow(
        "Resource does not exist",
      );
    });
  });

  describe("get", () => {
    it("returns log upload by ID", async () => {
      const logUpload = {
        id: "log-1",
        projectId: "proj-1",
        filename: "access.log",
        createdAt: new Date(),
        userId: "user-1",
        summary: {},
        totalRequests: 5,
        crawlerRequests: 2,
        uniqueIPs: 3,
      };
      logs.getById.mockResolvedValue(logUpload);
      const service = createLogService({ logs, projects });

      const result = await service.get("user-1", "log-1");
      expect(result).toEqual(logUpload);
    });

    it("throws NOT_FOUND when log does not exist", async () => {
      logs.getById.mockResolvedValue(undefined);
      const service = createLogService({ logs, projects });

      await expect(service.get("user-1", "log-999")).rejects.toThrow(
        "Log upload not found",
      );
    });

    it("throws NOT_FOUND when log belongs to another user's project", async () => {
      logs.getById.mockResolvedValue({
        id: "log-1",
        projectId: "proj-1",
      } as any);
      projects.getById.mockResolvedValue(
        buildProject({ userId: "other-user" }),
      );
      const service = createLogService({ logs, projects });

      await expect(service.get("user-1", "log-1")).rejects.toThrow(
        "Resource does not exist",
      );
    });
  });
});
