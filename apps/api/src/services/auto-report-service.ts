import { createDb, projectQueries, userQueries } from "@llm-boost/db";
import { createReportService } from "./report-service";
import {
  createReportRepository,
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "../repositories";
import { canGenerateReport } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoReportInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  reportServiceUrl: string;
  sharedSecret: string;
}

export async function runAutoReportGeneration(
  input: AutoReportInput,
): Promise<void> {
  const log = createLogger({ context: "auto-report" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  // Only Pro+ can generate reports
  if (user.plan !== "pro" && user.plan !== "agency") return;

  const reportRepo = createReportRepository(db);
  const usedThisMonth = await reportRepo.countThisMonth(project.userId);
  if (!canGenerateReport(user.plan, usedThisMonth, "summary")) return;

  const service = createReportService({
    reports: reportRepo,
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    await service.generate(
      project.userId,
      {
        projectId: input.projectId,
        crawlJobId: input.crawlJobId,
        type: "summary",
        format: "pdf",
      },
      {
        reportServiceUrl: input.reportServiceUrl,
        sharedSecret: input.sharedSecret,
      },
    );
    log.info("Auto-report queued", { crawlJobId: input.crawlJobId });
  } catch (err) {
    log.error("Auto-report generation failed", { error: String(err) });
  }
}
