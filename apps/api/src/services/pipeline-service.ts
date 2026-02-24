import { pipelineRunQueries, projectQueries } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";
import { runAutoSiteDescription } from "./auto-site-description-service";
import { runAutoPersonaGeneration } from "./auto-persona-service";
import { runAutoKeywordGeneration } from "./auto-keyword-service";
import { runAutoCompetitorDiscovery } from "./auto-competitor-service";
import { runAutoVisibilityChecks } from "./auto-visibility-service";
import { runContentOptimization } from "./content-optimization-service";
import { createRecommendationsService } from "./recommendations-service";
import { runHealthCheck } from "./health-check-service";
import type { createAuditService } from "./audit-service";

type AuditService = ReturnType<typeof createAuditService>;

const PIPELINE_STEPS = [
  "site_description",
  "personas",
  "keywords",
  "competitors",
  "visibility_check",
  "content_optimization",
  "action_report",
  "health_check",
] as const;

type StepName = (typeof PIPELINE_STEPS)[number];

interface PipelineKeys {
  databaseUrl: string;
  anthropicApiKey: string;
  perplexityApiKey?: string;
  grokApiKey?: string;
  reportServiceUrl?: string;
  sharedSecret?: string;
}

interface PipelineSettings {
  autoRunOnCrawl?: boolean;
  skipSteps?: string[];
}

export function createPipelineService(
  db: Database,
  audit: AuditService,
  keys: PipelineKeys,
) {
  const runs = pipelineRunQueries(db);
  const projects = projectQueries(db);

  async function runStep(
    runId: string,
    step: StepName,
    projectId: string,
    crawlJobId: string,
  ): Promise<void> {
    const start = Date.now();
    let stepOutput: Record<string, unknown> = {};
    try {
      switch (step) {
        case "site_description":
          await runAutoSiteDescription({
            databaseUrl: keys.databaseUrl,
            projectId,
            crawlJobId,
            anthropicApiKey: keys.anthropicApiKey,
          });
          break;
        case "personas":
          await runAutoPersonaGeneration({
            databaseUrl: keys.databaseUrl,
            projectId,
            anthropicApiKey: keys.anthropicApiKey,
          });
          break;
        case "keywords":
          await runAutoKeywordGeneration({
            databaseUrl: keys.databaseUrl,
            projectId,
            crawlJobId,
            anthropicApiKey: keys.anthropicApiKey,
          });
          break;
        case "competitors":
          await runAutoCompetitorDiscovery({
            databaseUrl: keys.databaseUrl,
            projectId,
            anthropicApiKey: keys.anthropicApiKey,
            perplexityApiKey: keys.perplexityApiKey,
            grokApiKey: keys.grokApiKey,
          });
          break;
        case "visibility_check":
          await runAutoVisibilityChecks({
            databaseUrl: keys.databaseUrl,
            projectId,
            apiKeys: {
              anthropicApiKey: keys.anthropicApiKey,
              perplexityApiKey: keys.perplexityApiKey ?? "",
              grokApiKey: keys.grokApiKey ?? "",
            },
          });
          break;
        case "content_optimization": {
          const result = await runContentOptimization({
            databaseUrl: keys.databaseUrl,
            projectId,
            crawlJobId,
            anthropicApiKey: keys.anthropicApiKey,
          });
          stepOutput = {
            pagesAnalyzed: result.pagesAnalyzed,
            suggestionsGenerated: result.suggestions.length,
          };
          break;
        }
        case "action_report": {
          const recommendations =
            await createRecommendationsService(db).getForProject(projectId);
          stepOutput = {
            actionsGenerated: recommendations.length,
            criticalActions: recommendations.filter(
              (r) => r.priority === "critical",
            ).length,
            highActions: recommendations.filter((r) => r.priority === "high")
              .length,
          };
          break;
        }
        case "health_check": {
          const result = await runHealthCheck({
            databaseUrl: keys.databaseUrl,
            projectId,
            crawlJobId,
          });
          stepOutput = {
            healthScore: result.score,
            checksRun: result.checks.length,
            failedChecks: result.checks.filter((c) => c.status === "fail")
              .length,
            warningChecks: result.checks.filter((c) => c.status === "warn")
              .length,
          };
          break;
        }
      }

      await runs.updateStep(runId, step, {
        status: "completed",
        duration_ms: Date.now() - start,
        ...stepOutput,
      });

      await audit.emitEvent({
        action: "pipeline.step.completed",
        actorId: "system",
        resourceType: "pipeline_run",
        resourceId: runId,
        metadata: { step, duration_ms: Date.now() - start },
      });
    } catch (err) {
      await runs.updateStep(runId, step, {
        status: "failed",
        duration_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't rethrow — continue with next step
    }
  }

  return {
    async start(projectId: string, crawlJobId: string) {
      const project = await projects.getById(projectId);
      if (!project) throw new Error("Project not found");

      const settings = (project.pipelineSettings ?? {}) as PipelineSettings;
      const skipSteps = new Set(settings.skipSteps ?? []);

      const run = await runs.create({
        projectId,
        crawlJobId,
        settings: settings as Record<string, unknown>,
      });

      await runs.updateStatus(run.id, "running", { startedAt: new Date() });

      await audit.emitEvent({
        action: "pipeline.started",
        actorId: "system",
        resourceType: "pipeline_run",
        resourceId: run.id,
        metadata: { projectId, crawlJobId },
      });

      for (const step of PIPELINE_STEPS) {
        if (skipSteps.has(step)) {
          await runs.updateStep(run.id, step, { status: "skipped" });
          await audit.emitEvent({
            action: "pipeline.step.skipped",
            actorId: "system",
            resourceType: "pipeline_run",
            resourceId: run.id,
            metadata: { step },
          });
          continue;
        }

        await runs.updateStatus(run.id, "running", { currentStep: step });
        await runStep(run.id, step, projectId, crawlJobId);
      }

      await runs.updateStatus(run.id, "completed", {
        currentStep: null,
        completedAt: new Date(),
      });

      await audit.emitEvent({
        action: "pipeline.completed",
        actorId: "system",
        resourceType: "pipeline_run",
        resourceId: run.id,
        metadata: { projectId },
      });

      return runs.getById(run.id);
    },

    async getLatest(projectId: string) {
      return runs.getLatestByProject(projectId);
    },

    async list(projectId: string) {
      return runs.listByProject(projectId);
    },
  };
}
