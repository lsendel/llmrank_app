import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRegressionService,
  type Regression,
} from "../../services/regression-service";

describe("RegressionService", () => {
  const createNotificationMock = vi.fn().mockResolvedValue({});
  const createActionItemMock = vi.fn().mockResolvedValue({});
  const getOpenActionItemMock = vi.fn().mockResolvedValue(undefined);

  function makeDeps(crawls: any[], options?: { withActionItems?: boolean }) {
    return {
      crawls: {
        listByProject: vi.fn().mockResolvedValue(crawls),
      },
      notifications: {
        create: createNotificationMock,
      },
      ...(options?.withActionItems === false
        ? {}
        : {
            actionItems: {
              create: createActionItemMock,
              getOpenByProjectIssueCode: getOpenActionItemMock,
            },
          }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createActionItemMock.mockResolvedValue({});
    getOpenActionItemMock.mockResolvedValue(undefined);
  });

  describe("detectRegressions", () => {
    it("returns empty array when fewer than 2 completed crawls", async () => {
      const svc = createRegressionService(
        makeDeps([{ status: "complete", summaryData: { overallScore: 80 } }]),
      );

      const result = await svc.detectRegressions({ projectId: "p1" });
      expect(result).toEqual([]);
    });

    it("detects regression when score drops by more than threshold", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 70,
              technicalScore: 80,
              contentScore: 75,
              aiReadinessScore: 60,
              performanceScore: 85,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 82,
              technicalScore: 85,
              contentScore: 80,
              aiReadinessScore: 75,
              performanceScore: 88,
            },
          },
        ]),
      );

      const result = await svc.detectRegressions({ projectId: "p1" });

      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "Overall",
            delta: -12,
            severity: "warning",
          }),
        ]),
      );
      // AI Readiness dropped by -15
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "AI Readiness",
            delta: -15,
            severity: "critical",
          }),
        ]),
      );
    });

    it("returns empty array when no scores drop beyond threshold", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 82,
              technicalScore: 85,
              contentScore: 80,
              aiReadinessScore: 75,
              performanceScore: 88,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 84,
              contentScore: 79,
              aiReadinessScore: 74,
              performanceScore: 86,
            },
          },
        ]),
      );

      const result = await svc.detectRegressions({ projectId: "p1" });
      expect(result).toEqual([]);
    });

    it("skips non-complete crawls", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 50,
              technicalScore: 50,
              contentScore: 50,
              aiReadinessScore: 50,
              performanceScore: 50,
            },
          },
          { status: "in_progress", summaryData: null },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      const result = await svc.detectRegressions({ projectId: "p1" });

      // Only 2 completed crawls: 50 (latest) vs 80 (previous) => -30 overall
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "Overall",
            delta: -30,
            severity: "critical",
          }),
        ]),
      );
    });

    it("classifies severity correctly", async () => {
      // -5 to -9 = info, -10 to -14 = warning, -15+ = critical
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 70,
              technicalScore: 85,
              contentScore: 72,
              aiReadinessScore: 60,
              performanceScore: 82,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 76,
              technicalScore: 85,
              contentScore: 82,
              aiReadinessScore: 75,
              performanceScore: 82,
            },
          },
        ]),
      );

      const result = await svc.detectRegressions({ projectId: "p1" });

      const overall = result.find((r: Regression) => r.category === "Overall");
      expect(overall?.severity).toBe("info"); // -6

      const content = result.find((r: Regression) => r.category === "Content");
      expect(content?.severity).toBe("warning"); // -10

      const ai = result.find((r: Regression) => r.category === "AI Readiness");
      expect(ai?.severity).toBe("critical"); // -15
    });
  });

  describe("checkAndNotify", () => {
    it("sends notification when regressions are found", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 60,
              technicalScore: 70,
              contentScore: 70,
              aiReadinessScore: 50,
              performanceScore: 70,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      const regressions = await svc.checkAndNotify({
        projectId: "p1",
        userId: "u1",
      });

      expect(regressions.length).toBeGreaterThan(0);
      expect(createNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          type: "regression_alert",
          title: expect.stringContaining("regression"),
        }),
      );
    });

    it("does not send notification when no regressions", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 85,
              technicalScore: 85,
              contentScore: 85,
              aiReadinessScore: 85,
              performanceScore: 85,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      const regressions = await svc.checkAndNotify({
        projectId: "p1",
        userId: "u1",
      });

      expect(regressions).toEqual([]);
      expect(createNotificationMock).not.toHaveBeenCalled();
    });

    it("labels critical regressions in notification title", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 50,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      await svc.checkAndNotify({ projectId: "p1", userId: "u1" });

      expect(createNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Critical"),
        }),
      );
    });

    it("auto-creates action item for critical regression", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 50,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      await svc.checkAndNotify({ projectId: "p1", userId: "u1" });

      expect(getOpenActionItemMock).toHaveBeenCalledWith(
        "p1",
        "SCORE_REGRESSION_OVERALL",
      );
      expect(createActionItemMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "p1",
          issueCode: "SCORE_REGRESSION_OVERALL",
          status: "pending",
          severity: "critical",
          category: "technical",
          scoreImpact: 30,
          assigneeId: "u1",
          dueAt: expect.any(Date),
        }),
      );
      expect(createActionItemMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("Due by"),
        }),
      );
    });

    it("does not auto-create action item for non-critical regressions", async () => {
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 70,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      await svc.checkAndNotify({ projectId: "p1", userId: "u1" });

      expect(createActionItemMock).not.toHaveBeenCalled();
    });

    it("deduplicates auto-created action items when one is already open", async () => {
      getOpenActionItemMock.mockResolvedValue({ id: "existing" });
      const svc = createRegressionService(
        makeDeps([
          {
            status: "complete",
            summaryData: {
              overallScore: 50,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
          {
            status: "complete",
            summaryData: {
              overallScore: 80,
              technicalScore: 80,
              contentScore: 80,
              aiReadinessScore: 80,
              performanceScore: 80,
            },
          },
        ]),
      );

      await svc.checkAndNotify({ projectId: "p1", userId: "u1" });

      expect(getOpenActionItemMock).toHaveBeenCalledWith(
        "p1",
        "SCORE_REGRESSION_OVERALL",
      );
      expect(createActionItemMock).not.toHaveBeenCalled();
    });
  });
});
