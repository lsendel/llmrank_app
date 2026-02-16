import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDigestService } from "../../services/digest-service";

// Mock Resend
const resendSendMock = vi.fn().mockResolvedValue({ id: "email-1" });
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: resendSendMock },
  })),
}));

// Mock DB queries
const getPreferencesMock = vi.fn();
const updatePreferencesMock = vi.fn();
const getUsersDueForDigestMock = vi.fn();
const markDigestSentMock = vi.fn();
const listByUserMock = vi.fn();
const listByProjectMock = vi.fn();
const getIssuesByJobMock = vi.fn();

vi.mock("@llm-boost/db", async () => {
  const actual =
    await vi.importActual<typeof import("@llm-boost/db")>("@llm-boost/db");
  return {
    ...actual,
    digestPreferenceQueries: vi.fn(() => ({
      getPreferences: getPreferencesMock,
      updatePreferences: updatePreferencesMock,
      getUsersDueForDigest: getUsersDueForDigestMock,
      markDigestSent: markDigestSentMock,
    })),
    projectQueries: vi.fn(() => ({
      listByUser: listByUserMock,
    })),
    crawlQueries: vi.fn(() => ({
      listByProject: listByProjectMock,
    })),
    scoreQueries: vi.fn(() => ({
      getIssuesByJob: getIssuesByJobMock,
    })),
  };
});

vi.mock("@llm-boost/shared", () => ({
  aggregatePageScores: vi.fn(),
}));

function makeDb() {
  return {} as any;
}

const RESEND_KEY = "re_test_key";
const OPTIONS = { appBaseUrl: "https://app.llmboost.io" };

describe("DigestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processWeeklyDigests", () => {
    it("sends weekly digest emails for due users", async () => {
      getUsersDueForDigestMock.mockResolvedValue([
        {
          id: "u1",
          email: "alice@test.com",
          digestFrequency: "weekly",
          digestDay: 1,
        },
      ]);
      listByUserMock.mockResolvedValue([
        { id: "p1", name: "My Site", domain: "example.com" },
      ]);
      listByProjectMock.mockResolvedValue([
        {
          id: "crawl-1",
          status: "complete",
          completedAt: new Date(),
          summaryData: { overallScore: 82, letterGrade: "B" },
          pagesScored: 5,
        },
        {
          id: "crawl-2",
          status: "complete",
          completedAt: new Date(Date.now() - 7 * 86400000),
          summaryData: { overallScore: 78, letterGrade: "C" },
          pagesScored: 5,
        },
      ]);
      getIssuesByJobMock.mockResolvedValue([
        {
          code: "MISSING_TITLE",
          pageId: "pg1",
          severity: "critical",
          message: "Missing title",
        },
      ]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      const sent = await service.processWeeklyDigests();

      expect(sent).toBe(1);
      expect(resendSendMock).toHaveBeenCalledTimes(1);
      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["alice@test.com"],
          subject: "Weekly Digest: My Site",
        }),
      );
      expect(markDigestSentMock).toHaveBeenCalledWith("u1");
    });

    it("skips users with no projects", async () => {
      getUsersDueForDigestMock.mockResolvedValue([
        {
          id: "u1",
          email: "empty@test.com",
          digestFrequency: "weekly",
          digestDay: 1,
        },
      ]);
      listByUserMock.mockResolvedValue([]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      const sent = await service.processWeeklyDigests();

      expect(sent).toBe(0);
      expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("skips projects with no completed crawls", async () => {
      getUsersDueForDigestMock.mockResolvedValue([
        {
          id: "u1",
          email: "alice@test.com",
          digestFrequency: "weekly",
          digestDay: 1,
        },
      ]);
      listByUserMock.mockResolvedValue([
        { id: "p1", name: "My Site", domain: "example.com" },
      ]);
      listByProjectMock.mockResolvedValue([
        { id: "crawl-1", status: "pending", summaryData: null },
      ]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      await service.processWeeklyDigests();

      expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("returns 0 when no users are due", async () => {
      getUsersDueForDigestMock.mockResolvedValue([]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      const sent = await service.processWeeklyDigests();

      expect(sent).toBe(0);
    });

    it("continues processing after individual user failure", async () => {
      getUsersDueForDigestMock.mockResolvedValue([
        {
          id: "u1",
          email: "fail@test.com",
          digestFrequency: "weekly",
          digestDay: 1,
        },
        {
          id: "u2",
          email: "good@test.com",
          digestFrequency: "weekly",
          digestDay: 1,
        },
      ]);
      listByUserMock
        .mockRejectedValueOnce(new Error("DB timeout"))
        .mockResolvedValueOnce([
          { id: "p2", name: "Good Site", domain: "good.com" },
        ]);
      listByProjectMock.mockResolvedValue([
        {
          id: "crawl-1",
          status: "complete",
          completedAt: new Date(),
          summaryData: { overallScore: 90, letterGrade: "A" },
          pagesScored: 10,
        },
      ]);
      getIssuesByJobMock.mockResolvedValue([]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      const sent = await service.processWeeklyDigests();

      expect(sent).toBe(1);
      expect(markDigestSentMock).toHaveBeenCalledWith("u2");
    });
  });

  describe("processMonthlyDigests", () => {
    it("sends a cross-project monthly digest", async () => {
      getUsersDueForDigestMock.mockResolvedValue([
        {
          id: "u1",
          email: "bob@test.com",
          digestFrequency: "monthly",
          digestDay: 1,
        },
      ]);
      listByUserMock.mockResolvedValue([
        { id: "p1", name: "Site A", domain: "a.com" },
        { id: "p2", name: "Site B", domain: "b.com" },
      ]);
      listByProjectMock.mockResolvedValue([
        {
          id: "crawl-1",
          status: "complete",
          completedAt: new Date(),
          summaryData: { overallScore: 75, letterGrade: "C" },
          pagesScored: 10,
        },
      ]);
      getIssuesByJobMock.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      const sent = await service.processMonthlyDigests();

      expect(sent).toBe(1);
      expect(resendSendMock).toHaveBeenCalledTimes(1);
      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["bob@test.com"],
          subject: "Monthly AI-Readiness Report",
        }),
      );
      expect(markDigestSentMock).toHaveBeenCalledWith("u1");
    });

    it("returns 0 when no users are due", async () => {
      getUsersDueForDigestMock.mockResolvedValue([]);

      const service = createDigestService(makeDb(), RESEND_KEY, OPTIONS);
      const sent = await service.processMonthlyDigests();

      expect(sent).toBe(0);
    });
  });
});
