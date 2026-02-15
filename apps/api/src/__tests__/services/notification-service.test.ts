import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Database } from "@llm-boost/db";
import { createNotificationService } from "../../services/notification-service";
import { buildUser, type UserEntity } from "../helpers/factories";

const enqueueMock = vi.fn();
const resendSendMock = vi.fn();

vi.mock("@llm-boost/db", async () => {
  const actual =
    await vi.importActual<typeof import("@llm-boost/db")>("@llm-boost/db");
  return {
    ...actual,
    outboxQueries: vi.fn(() => ({ enqueue: enqueueMock })),
  };
});

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: resendSendMock },
  })),
}));

describe("NotificationService", () => {
  const RESEND_KEY = "re_test_key";

  beforeEach(() => {
    vi.clearAllMocks();
    enqueueMock.mockReset();
    resendSendMock.mockReset();
  });

  describe("queueEmail", () => {
    it("enqueues payload with template namespace", async () => {
      const { db } = createDbMock(buildUser({ email: "user@test.com" }));
      const service = createNotificationService(db, RESEND_KEY);

      await service.queueEmail({
        userId: "u1",
        to: "user@test.com",
        template: "crawl_completed",
        data: { projectId: "p1" },
      });

      expect(enqueueMock).toHaveBeenCalledWith({
        type: "email:crawl_completed",
        payload: {
          userId: "u1",
          to: "user@test.com",
          data: { projectId: "p1" },
        },
      });
    });
  });

  describe("sendCrawlComplete", () => {
    it("queues notification when user has email", async () => {
      const user = buildUser({ email: "user@test.com" });
      const { db } = createDbMock(user);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendCrawlComplete({
        userId: user.id,
        projectId: "p1",
        projectName: "My Site",
        jobId: "j1",
      });

      expect(enqueueMock).toHaveBeenCalledWith({
        type: "email:crawl_completed",
        payload: {
          userId: user.id,
          to: "user@test.com",
          data: {
            projectName: "My Site",
            projectId: "p1",
            jobId: "j1",
          },
        },
      });
    });

    it("skips when user not found", async () => {
      const { db } = createDbMock(null);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendCrawlComplete({
        userId: "missing",
        projectId: "p1",
        projectName: "My Site",
        jobId: "j1",
      });

      expect(enqueueMock).not.toHaveBeenCalled();
    });
  });

  describe("sendScoreDrop", () => {
    it("queues alert when score decreases", async () => {
      const user = buildUser({ email: "user@test.com" });
      const { db } = createDbMock(user);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendScoreDrop({
        userId: user.id,
        projectId: "p1",
        projectName: "My Site",
        previousScore: 85,
        currentScore: 70,
      });

      expect(enqueueMock).toHaveBeenCalledWith({
        type: "email:score_drop",
        payload: {
          userId: user.id,
          to: "user@test.com",
          data: {
            userId: user.id,
            projectId: "p1",
            projectName: "My Site",
            previousScore: 85,
            currentScore: 70,
          },
        },
      });
    });

    it("skips when score did not drop", async () => {
      const user = buildUser({ email: "user@test.com" });
      const { db } = createDbMock(user);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendScoreDrop({
        userId: user.id,
        projectId: "p1",
        projectName: "My Site",
        previousScore: 70,
        currentScore: 85,
      });

      expect(enqueueMock).not.toHaveBeenCalled();
    });

    it("skips when user not found", async () => {
      const { db } = createDbMock(null);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendScoreDrop({
        userId: "missing",
        projectId: "p1",
        projectName: "My Site",
        previousScore: 90,
        currentScore: 60,
      });

      expect(enqueueMock).not.toHaveBeenCalled();
    });
  });

  describe("processQueue", () => {
    it("processes pending email events and marks them completed", async () => {
      const events = [
        {
          id: "evt-1",
          type: "email:crawl_completed",
          status: "pending",
          attempts: 0,
          payload: {
            to: "user@test.com",
            data: {
              projectName: "My Site",
              score: 85,
              grade: "B",
              issueCount: 3,
              projectId: "p1",
            },
          },
          availableAt: new Date(),
        },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const { db } = createDbMockWithQueue(events, updateMock);
      resendSendMock.mockResolvedValue({ id: "msg-1" });
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();

      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining("LLM Boost"),
          to: ["user@test.com"],
        }),
      );
      expect(updateMock).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          processedAt: expect.any(Date),
        }),
      );
    });

    it("increments attempt count on send failure", async () => {
      const events = [
        {
          id: "evt-1",
          type: "email:crawl_completed",
          status: "pending",
          attempts: 1,
          payload: {
            to: "user@test.com",
            data: { projectName: "Site" },
          },
          availableAt: new Date(),
        },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const { db } = createDbMockWithQueue(events, updateMock);
      resendSendMock.mockRejectedValue(new Error("SMTP error"));
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();

      // Should update attempts to 2 (was 1, incremented)
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ attempts: 2 }),
      );
    });

    it("skips non-email event types", async () => {
      const events = [
        {
          id: "evt-1",
          type: "webhook:something",
          status: "pending",
          attempts: 0,
          payload: { data: {} },
          availableAt: new Date(),
        },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const { db } = createDbMockWithQueue(events, updateMock);
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();

      expect(resendSendMock).not.toHaveBeenCalled();
      // Should still mark as completed
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" }),
      );
    });

    it("does nothing when no pending events exist", async () => {
      const { db } = createDbMockWithQueue([], vi.fn());
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();
      expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("renders correct subject for score_drop events", async () => {
      const events = [
        {
          id: "evt-1",
          type: "email:score_drop",
          status: "pending",
          attempts: 0,
          payload: {
            to: "user@test.com",
            data: {
              projectName: "My Site",
              previousScore: 85,
              currentScore: 70,
            },
          },
          availableAt: new Date(),
        },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const { db } = createDbMockWithQueue(events, updateMock);
      resendSendMock.mockResolvedValue({ id: "msg-1" });
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();

      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Score Dropped"),
        }),
      );
    });

    it("renders correct subject for credit_alert events", async () => {
      const events = [
        {
          id: "evt-1",
          type: "email:credit_alert",
          status: "pending",
          attempts: 0,
          payload: { to: "user@test.com", data: {} },
          availableAt: new Date(),
        },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const { db } = createDbMockWithQueue(events, updateMock);
      resendSendMock.mockResolvedValue({ id: "msg-1" });
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();

      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Credits"),
        }),
      );
    });

    it("renders fallback subject for unknown event types", async () => {
      const events = [
        {
          id: "evt-1",
          type: "email:unknown_template",
          status: "pending",
          attempts: 0,
          payload: { to: "user@test.com", data: {} },
          availableAt: new Date(),
        },
      ];
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const { db } = createDbMockWithQueue(events, updateMock);
      resendSendMock.mockResolvedValue({ id: "msg-1" });
      const service = createNotificationService(db, RESEND_KEY);

      await service.processQueue();

      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Competitor"),
        }),
      );
    });
  });

  describe("sendScoreDrop (edge cases)", () => {
    it("skips when scores are equal", async () => {
      const user = buildUser({ email: "user@test.com" });
      const { db } = createDbMock(user);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendScoreDrop({
        userId: user.id,
        projectId: "p1",
        projectName: "My Site",
        previousScore: 85,
        currentScore: 85,
      });

      expect(enqueueMock).not.toHaveBeenCalled();
    });

    it("skips when user has no email", async () => {
      const user = buildUser({ email: null as any });
      const { db } = createDbMock(user);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendScoreDrop({
        userId: user.id,
        projectId: "p1",
        projectName: "My Site",
        previousScore: 85,
        currentScore: 70,
      });

      expect(enqueueMock).not.toHaveBeenCalled();
    });
  });

  describe("sendCrawlComplete (edge cases)", () => {
    it("skips when user email is empty string", async () => {
      const user = buildUser({ email: "" as any });
      const { db } = createDbMock(user);
      const service = createNotificationService(db, RESEND_KEY);

      await service.sendCrawlComplete({
        userId: user.id,
        projectId: "p1",
        projectName: "My Site",
        jobId: "j1",
      });

      // Empty string is falsy - should skip
      expect(enqueueMock).not.toHaveBeenCalled();
    });
  });
});

function createDbMock(user: UserEntity | null): { db: Database } {
  const db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  } as unknown as Database;
  return { db };
}

function createDbMockWithQueue(
  events: unknown[],
  updateMock: ReturnType<typeof vi.fn>,
): { db: Database } {
  const limitMock = vi.fn().mockResolvedValue(events);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  const db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    select: selectMock,
    update: updateMock,
  } as unknown as Database;
  return { db };
}
