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
        brandingLogoUrl:
          (input.config as any)?.brandingLogoUrl ?? branding.logoUrl,
        brandingColor:
          (input.config as any)?.brandingColor ?? branding.primaryColor,
        preparedFor: (input.config as any)?.preparedFor ?? branding.companyName,
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

      // 6. Dispatch to report service via HTTP (HMAC-authenticated)
      const job: GenerateReportJob = {
        reportId: report.id,
        projectId: input.projectId,
        crawlJobId: input.crawlJobId,
        userId,
        type: input.type,
        format: input.format,
        config: mergedConfig as ReportConfig,
        databaseUrl: "",
        isPublic: !!(input.config as any)?.isPublic,
      };

      const body = JSON.stringify(job);
      const { signature, timestamp } = await signPayload(
        env.sharedSecret,
        body,
      );

      const res = await fetch(`${env.reportServiceUrl}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
          "X-Timestamp": timestamp,
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new ServiceError(
          "INTERNAL_ERROR",
          500,
          `Report service dispatch failed: ${text}`,
        );
      }

      return report;
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
