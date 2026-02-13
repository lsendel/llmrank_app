import { eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  pageScores,
  issues,
  issueCategoryEnum,
  issueSeverityEnum,
} from "../schema";

type IssueCategory = (typeof issueCategoryEnum.enumValues)[number];
type IssueSeverity = (typeof issueSeverityEnum.enumValues)[number];

export function scoreQueries(db: Database) {
  return {
    async create(data: {
      pageId: string;
      jobId: string;
      overallScore: number;
      technicalScore?: number | null;
      contentScore?: number | null;
      aiReadinessScore?: number | null;
      lighthousePerf?: number | null;
      lighthouseSeo?: number | null;
      detail?: unknown;
    }) {
      const [score] = await db.insert(pageScores).values(data).returning();
      return score;
    },

    async getByPage(pageId: string) {
      return db.query.pageScores.findFirst({
        where: eq(pageScores.pageId, pageId),
      });
    },

    async listByJob(jobId: string) {
      return db.query.pageScores.findMany({
        where: eq(pageScores.jobId, jobId),
      });
    },

    async createIssues(
      rows: Array<{
        pageId: string;
        jobId: string;
        category: IssueCategory;
        severity: IssueSeverity;
        code: string;
        message: string;
        recommendation?: string | null;
        data?: unknown;
      }>,
    ) {
      if (rows.length === 0) return [];
      return db.insert(issues).values(rows).returning();
    },

    async getIssuesByPage(pageId: string) {
      return db.query.issues.findMany({ where: eq(issues.pageId, pageId) });
    },

    async getIssuesByJob(jobId: string) {
      return db.query.issues.findMany({ where: eq(issues.jobId, jobId) });
    },
  };
}
