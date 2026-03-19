import {
  createDb,
  projectQueries,
  savedKeywordQueries,
  competitorQueries,
  userQueries,
  scoreQueries,
} from "@llm-boost/db";

export interface HealthCheckInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
}

interface CheckResult {
  check: string;
  category: "technical" | "configuration" | "billing";
  status: "pass" | "warn" | "fail";
  message: string;
  autoFixable: boolean;
  suggestion?: string;
}

export interface HealthCheckResult {
  projectId: string;
  crawlJobId: string;
  checks: CheckResult[];
  score: number;
}

export async function runHealthCheck(
  input: HealthCheckInput,
): Promise<HealthCheckResult> {
  const db = createDb(input.databaseUrl);
  const project = await projectQueries(db).getById(input.projectId);
  if (!project) throw new Error("Project not found");

  const user = await userQueries(db).getById(project.userId);
  const keywordCount = await savedKeywordQueries(db).countByProject(
    input.projectId,
  );
  const competitors = await competitorQueries(db).listByProject(
    input.projectId,
  );
  const issues = await scoreQueries(db).getIssuesByJob(input.crawlJobId);

  const checks: CheckResult[] = [];
  const issueCodes = new Set(issues.map((i) => i.code));

  // Technical checks from crawl issues
  if (issueCodes.has("AI_CRAWLER_BLOCKED")) {
    checks.push({
      check: "ai_crawler_access",
      category: "technical",
      status: "fail",
      message: "AI crawlers are blocked in robots.txt",
      autoFixable: true,
      suggestion: "Update robots.txt to allow GPTBot, ClaudeBot, PerplexityBot",
    });
  } else {
    checks.push({
      check: "ai_crawler_access",
      category: "technical",
      status: "pass",
      message: "AI crawlers have access",
      autoFixable: false,
    });
  }

  if (issueCodes.has("MISSING_LLMS_TXT")) {
    checks.push({
      check: "llms_txt",
      category: "technical",
      status: "fail",
      message: "No llms.txt file found",
      autoFixable: true,
      suggestion: "Generate llms.txt from site context to guide AI crawlers",
    });
  } else {
    checks.push({
      check: "llms_txt",
      category: "technical",
      status: "pass",
      message: "llms.txt is present",
      autoFixable: false,
    });
  }

  // Configuration checks
  if (competitors.length === 0) {
    checks.push({
      check: "competitors_tracked",
      category: "configuration",
      status: "fail",
      message: "No competitors tracked",
      autoFixable: true,
      suggestion: "Run competitor auto-discovery to identify top competitors",
    });
  } else {
    checks.push({
      check: "competitors_tracked",
      category: "configuration",
      status: "pass",
      message: `${competitors.length} competitors tracked`,
      autoFixable: false,
    });
  }

  if (keywordCount < 5) {
    checks.push({
      check: "keyword_coverage",
      category: "configuration",
      status: "fail",
      message: `Only ${keywordCount} keywords tracked (recommend 5+)`,
      autoFixable: true,
      suggestion: "Generate more keywords from crawl data",
    });
  } else {
    checks.push({
      check: "keyword_coverage",
      category: "configuration",
      status: "pass",
      message: `${keywordCount} keywords tracked`,
      autoFixable: false,
    });
  }

  if (project.crawlSchedule === "manual" && user && user.plan !== "free") {
    checks.push({
      check: "crawl_schedule",
      category: "configuration",
      status: "warn",
      message: "Crawl schedule is manual on a paid plan",
      autoFixable: true,
      suggestion: "Enable weekly automatic crawls to track changes",
    });
  }

  const passCount = checks.filter((c) => c.status === "pass").length;
  const score =
    checks.length > 0 ? Math.round((passCount / checks.length) * 100) : 100;

  return {
    projectId: input.projectId,
    crawlJobId: input.crawlJobId,
    checks,
    score,
  };
}
