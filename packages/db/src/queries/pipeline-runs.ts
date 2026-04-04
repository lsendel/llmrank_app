import { eq, desc } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { pipelineRuns } from "../schema";

export function pipelineRunQueries(db: Database) {
  return {
    async create(data: {
      projectId: string;
      crawlJobId?: string;
      settings?: Record<string, unknown>;
    }) {
      const [run] = await db
        .insert(pipelineRuns)
        .values({
          ...data,
          id: crypto.randomUUID(),
          settings: data.settings ? JSON.stringify(data.settings) : undefined,
        })
        .returning();
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
      const setData: Record<string, unknown> = { status };
      if (extra?.currentStep !== undefined)
        setData.currentStep = extra.currentStep;
      if (extra?.error !== undefined) setData.error = extra.error;
      if (extra?.completedAt !== undefined)
        setData.completedAt = extra.completedAt.toISOString();
      if (extra?.startedAt !== undefined)
        setData.startedAt = extra.startedAt.toISOString();
      const [updated] = await db
        .update(pipelineRuns)
        .set(setData)
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
      const parsed = existing?.stepResults
        ? typeof existing.stepResults === "string"
          ? JSON.parse(existing.stepResults)
          : existing.stepResults
        : {};
      const stepResults = {
        ...(parsed as Record<string, unknown>),
        [stepName]: stepResult,
      };
      const [updated] = await db
        .update(pipelineRuns)
        .set({
          stepResults: JSON.stringify(stepResults),
          currentStep: stepName,
        })
        .where(eq(pipelineRuns.id, id))
        .returning();
      return updated;
    },
  };
}
