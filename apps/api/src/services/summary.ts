import {
  createDb,
  projectQueries,
  scoreQueries,
  crawlQueries,
  pageQueries,
  type Database,
} from "@llm-boost/db";
import { SummaryGenerator } from "@llm-boost/llm";
import {
  getQuickWins,
  aggregatePageScores,
  type QuickWin,
} from "@llm-boost/shared";
import { toAggregateInput } from "./score-helpers";
import { createNotificationService } from "./notification-service";
import { createProgressService } from "./progress-service";

export interface SummaryDataInput {
  databaseUrl: string;
  projectId: string;
  jobId: string;
  resendApiKey?: string;
  appBaseUrl?: string;
}

export interface SummaryInput extends SummaryDataInput {
  anthropicApiKey: string;
}

export interface CrawlSummaryData {
  project: {
    id: string;
    name: string;
    domain: string;
  };
  overallScore: number;
  letterGrade: string;
  categoryScores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  quickWins: QuickWin[];
  pagesScored: number;
  generatedAt: string;
  issueCount: number;
}

export async function persistCrawlSummaryData(
  input: SummaryDataInput,
): Promise<CrawlSummaryData | null> {
  const db = createDb(input.databaseUrl);
  const summaryData = await persistSummaryWithDb(db, input);
  if (summaryData) {
    await detectAnomaliesAndNotify(db, {
      projectId: input.projectId,
      jobId: input.jobId,
      resendApiKey: input.resendApiKey,
      appBaseUrl: input.appBaseUrl,
    });
  }

  return summaryData;
}

/**
 * Generates an executive summary for a completed crawl job and stores it on
 * the crawl record. Also ensures the aggregate summary cache is up to date.
 */
export async function generateCrawlSummary(input: SummaryInput): Promise<void> {
  const db = createDb(input.databaseUrl);
  const summaryGenerator = new SummaryGenerator({
    anthropicApiKey: input.anthropicApiKey,
  });

  const summaryData = await persistSummaryWithDb(db, input);
  if (!summaryData) return;

  const summary = await summaryGenerator.generateExecutiveSummary({
    projectName: summaryData.project.name,
    domain: summaryData.project.domain,
    overallScore: summaryData.overallScore,
    categoryScores: summaryData.categoryScores,
    quickWins: summaryData.quickWins,
    pagesScored: summaryData.pagesScored,
  });

  await crawlQueries(db).updateSummary(input.jobId, summary);
}

async function persistSummaryWithDb(
  db: Database,
  input: SummaryDataInput,
): Promise<CrawlSummaryData | null> {
  const projectQuery = projectQueries(db);
  const scoreQuery = scoreQueries(db);
  const crawlQuery = crawlQueries(db);

  const [project, pageScores, issues] = await Promise.all([
    projectQuery.getById(input.projectId),
    scoreQuery.listByJob(input.jobId),
    scoreQuery.getIssuesByJob(input.jobId),
  ]);

  if (!project || pageScores.length === 0) {
    await crawlQuery.updateSummaryData(input.jobId, null);
    return null;
  }

  const agg = aggregatePageScores(toAggregateInput(pageScores));
  const quickWins = getQuickWins(issues ?? []);

  const summaryData: CrawlSummaryData = {
    project: { id: project.id, name: project.name, domain: project.domain },
    overallScore: agg.overallScore,
    letterGrade: agg.letterGrade,
    categoryScores: agg.scores,
    quickWins,
    pagesScored: pageScores.length,
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
  };

  await crawlQuery.updateSummaryData(input.jobId, summaryData);
  return summaryData;
}

async function detectAnomaliesAndNotify(
  db: Database,
  args: {
    projectId: string;
    jobId: string;
    resendApiKey?: string;
    appBaseUrl?: string;
  },
) {
  if (!args.resendApiKey) return;
  const project = await projectQueries(db).getById(args.projectId);
  if (!project) return;

  const notifier = createNotificationService(db, args.resendApiKey, {
    appBaseUrl: args.appBaseUrl,
  });

  // 1. Detect Score Regression
  const progressService = createProgressService({
    crawls: crawlQueries(db),
    projects: projectQueries(db),
    scores: scoreQueries(db),
    pages: pageQueries(db),
  });

  const progress = await progressService.getProjectProgress(
    project.userId,
    args.projectId,
  );

  if (progress) {
    const drop = progress.currentScore - progress.previousScore;
    const threshold = -5; // notify when score drops by 5+ points
    if (drop <= threshold) {
      await notifier.sendScoreDrop({
        userId: project.userId,
        projectId: args.projectId,
        projectName: project.name,
        previousScore: Math.round(progress.previousScore),
        currentScore: Math.round(progress.currentScore),
      });
    }
  }

  // 2. Detect High-ROI Quick Wins
  const issues = await scoreQueries(db).getIssuesByJob(args.jobId);
  const quickWins = getQuickWins(issues);
  const highRoiWins = quickWins.filter(
    (w) => w.scoreImpact >= 10 && w.effortLevel === "low",
  );

  if (highRoiWins.length > 0) {
    await notifier.sendHighRoiAlert({
      userId: project.userId,
      projectId: args.projectId,
      projectName: project.name,
      wins: highRoiWins.slice(0, 3),
    });
  }
}
