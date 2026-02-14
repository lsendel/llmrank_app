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
