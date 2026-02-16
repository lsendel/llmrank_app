import { ServiceError } from "./errors";
import { canGenerateReport } from "@llm-boost/shared";
import type { GenerateReportInput, ReportConfig } from "@llm-boost/shared";
import type { GenerateReportJob } from "@llm-boost/reports";
import { signPayload } from "../middleware/hmac";
import type {
  ReportRepository,
  ProjectRepository,
  UserRepository,
  CrawlRepository,
} from "../repositories";

interface Deps {
  reports: ReportRepository;
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
}

interface DispatchEnv {
  reportServiceUrl: string;
  sharedSecret: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const TIMEOUT_MS = 15_000;

export function createReportService(deps: Deps) {
  return {
    async generate(
      userId: string,
      input: GenerateReportInput,
      env: DispatchEnv,
    ) {
      // 1. Verify project ownership
      const project = await deps.projects.getById(input.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      // 2. Verify crawl belongs to project
      const crawl = await deps.crawls.getById(input.crawlJobId);
      if (!crawl || crawl.projectId !== input.projectId) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }

      if (crawl.status !== "complete") {
        throw new ServiceError(
          "INVALID_STATE",
          409,
          "Crawl must be complete before generating a report",
        );
      }

      // 3. Check plan limits
      const user = await deps.users.getById(userId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", 404, "User not found");
      }

      const usedThisMonth = await deps.reports.countThisMonth(userId);
      if (!canGenerateReport(user.plan, usedThisMonth, input.type)) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Report generation limit reached for your plan",
        );
      }

      // 4. Auto-inherit project branding into report config
      const branding = (project.branding ?? {}) as {
        logoUrl?: string;
        companyName?: string;
        primaryColor?: string;
      };
      const mergedConfig = {
        ...(input.config ?? {}),
        brandingLogoUrl: input.config?.brandingLogoUrl ?? branding.logoUrl,
        brandingColor: input.config?.brandingColor ?? branding.primaryColor,
        preparedFor: input.config?.preparedFor ?? branding.companyName,
      };

      // 5. Create report record
      const report = await deps.reports.create({
        projectId: input.projectId,
        crawlJobId: input.crawlJobId,
        userId,
        type: input.type,
        format: input.format,
        status: "queued",
        config: mergedConfig,
      });

      // 6. Dispatch to report service via HTTP (HMAC-authenticated, with retry)
      const job: GenerateReportJob = {
        reportId: report.id,
        projectId: input.projectId,
        crawlJobId: input.crawlJobId,
        userId,
        type: input.type,
        format: input.format,
        config: mergedConfig as ReportConfig,
        isPublic: !!(input.config as Record<string, unknown> | undefined)
          ?.isPublic,
      };

      const body = JSON.stringify(job);
      let lastError: unknown;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Re-sign on each attempt so timestamp stays fresh
          const { signature, timestamp } = await signPayload(
            env.sharedSecret,
            body,
          );

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

          const res = await fetch(`${env.reportServiceUrl}/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Signature": signature,
              "X-Timestamp": timestamp,
            },
            body,
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (res.ok) return report;

          // 4xx = don't retry (auth or validation issue)
          if (res.status >= 400 && res.status < 500) {
            const text = await res.text().catch(() => "Unknown error");
            throw new ServiceError(
              "REPORT_SERVICE_REJECTED",
              502,
              `Report service rejected the request: ${text}`,
            );
          }

          // 5xx = retryable
          lastError = new Error(`HTTP ${res.status}`);
        } catch (error) {
          if (error instanceof ServiceError) throw error;
          lastError = error;
        }

        // Exponential backoff before retry
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) =>
            setTimeout(r, BASE_DELAY_MS * Math.pow(3, attempt)),
          );
        }
      }

      // All retries exhausted
      const isTimeout =
        lastError instanceof Error && lastError.name === "AbortError";
      throw new ServiceError(
        isTimeout ? "REPORT_SERVICE_TIMEOUT" : "REPORT_SERVICE_UNAVAILABLE",
        isTimeout ? 504 : 503,
        isTimeout
          ? "Report service timed out. Please try again in a few minutes."
          : "Report service is temporarily unavailable. Please try again in a few minutes.",
      );
    },

    async list(userId: string, projectId: string) {
      // Verify ownership
      const project = await deps.projects.getById(projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }
      return deps.reports.listByProject(projectId);
    },

    async getStatus(userId: string, reportId: string) {
      const report = await deps.reports.getById(reportId);
      if (!report || report.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Report not found");
      }
      return report;
    },

    async deleteReport(userId: string, reportId: string, r2: R2Bucket) {
      const report = await deps.reports.getById(reportId);
      if (!report || report.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Report not found");
      }

      // Delete from R2 if exists
      if (report.r2Key) {
        await r2.delete(report.r2Key);
      }

      await deps.reports.delete(reportId);
    },
  };
}
