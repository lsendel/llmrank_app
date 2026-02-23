import { eq, desc } from "drizzle-orm";
import type { Database } from "../client";
import { pipelineRuns } from "../schema";

export function pipelineRunQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      crawlJobId?: string;
      settings?: Record<string, unknown>;
    }) {
      const [run] = await db.insert(pipelineRuns).values(data).returning();
      return run;
    },

    async getById(id: string) {
      return db.query.pipelineRuns.findFirst({
        where: eq(pipelineRuns.id, id),
      });
    },

    async getLatestByProject(projectId: string) {
      return db.query.pipelineRuns.findFirst({
        where: eq(pipelineRuns.projectId, projectId),
        orderBy: desc(pipelineRuns.createdAt),
      });
    },

    async listByProject(projectId: string) {
      return db.query.pipelineRuns.findMany({
        where: eq(pipelineRuns.projectId, projectId),
        orderBy: desc(pipelineRuns.createdAt),
      });
    },

    async updateStatus(
      id: string,
      status: "pending" | "running" | "paused" | "completed" | "failed",
      extra?: {
        currentStep?: string | null;
        error?: string;
        completedAt?: Date;
        startedAt?: Date;
      },
    ) {
      const [updated] = await db
        .update(pipelineRuns)
        .set({ status, ...extra })
        .where(eq(pipelineRuns.id, id))
        .returning();
      return updated;
    },

    async updateStep(
      id: string,
      stepName: string,
      stepResult: Record<string, unknown>,
    ) {
      const existing = await this.getById(id);
      const stepResults = {
        ...((existing?.stepResults as Record<string, unknown>) ?? {}),
        [stepName]: stepResult,
      };
      const [updated] = await db
        .update(pipelineRuns)
        .set({ stepResults, currentStep: stepName })
        .where(eq(pipelineRuns.id, id))
        .returning();
      return updated;
    },
  };
}
