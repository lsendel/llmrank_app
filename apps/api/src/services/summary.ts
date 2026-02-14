import {
  createDb,
  projectQueries,
  scoreQueries,
  crawlQueries,
} from "@llm-boost/db";
import { SummaryGenerator } from "@llm-boost/llm";
import { getQuickWins, aggregatePageScores } from "@llm-boost/shared";
import { toAggregateInput } from "./score-helpers";

export interface SummaryInput {
  databaseUrl: string;
  anthropicApiKey: string;
  projectId: string;
  jobId: string;
}

/**
 * Generates an executive summary for a completed crawl job.
 * Designed to run inside waitUntil() after the HTTP response is sent.
 */
export async function generateCrawlSummary(input: SummaryInput): Promise<void> {
  const db = createDb(input.databaseUrl);
  const summaryGenerator = new SummaryGenerator({
    anthropicApiKey: input.anthropicApiKey,
  });

  const [project, pageScores, issues] = await Promise.all([
    projectQueries(db).getById(input.projectId),
    scoreQueries(db).listByJob(input.jobId),
    scoreQueries(db).getIssuesByJob(input.jobId),
  ]);

  if (!project || pageScores.length === 0) return;

  const agg = aggregatePageScores(toAggregateInput(pageScores));
  const quickWins = getQuickWins(issues);

  const summary = await summaryGenerator.generateExecutiveSummary({
    projectName: project.name,
    domain: project.domain,
    overallScore: agg.overallScore,
    categoryScores: agg.scores,
    quickWins,
    pagesScored: pageScores.length,
  });

  await crawlQueries(db).updateSummary(input.jobId, summary);
}
