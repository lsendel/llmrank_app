import {
  PLAN_LIMITS,
  ERROR_CODES,
  getQuickWins,
  PLATFORM_REQUIREMENTS,
  aggregatePageScores,
  type CrawlJobPayload,
  type LLMPlatformId,
} from "@llm-boost/shared";
import { calculatePlatformScores } from "@llm-boost/scoring";
import type {
  CrawlRepository,
  ProjectRepository,
  UserRepository,
  ScoreRepository,
} from "../repositories";
import { ServiceError } from "./errors";
import { assertProjectOwnership } from "./shared/assert-ownership";
import { signPayload } from "../middleware/hmac";
import { fetchWithRetry } from "../lib/fetch-retry";
import { toAggregateInput } from "./score-helpers";

const ACTIVE_STATUSES = new Set(["pending", "queued", "crawling", "scoring"]);

export interface CrawlServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  users: UserRepository;
  scores: ScoreRepository;
}

export interface CrawlerDispatchEnv {
  crawlerUrl?: string;
  sharedSecret: string;
  queue?: any;
  kv?: { get(key: string): Promise<string | null> };
}

export function createCrawlService(deps: CrawlServiceDeps) {
  return {
    async requestCrawl(args: {
      userId: string;
      projectId: string;
      requestUrl: string;
      env: CrawlerDispatchEnv;
    }) {
      const project = await assertProjectOwnership(
        deps.projects,
        args.userId,
        args.projectId,
      );
      const user = await deps.users.getById(args.userId);
      if (!user) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "User not found");
      }

      if (user.crawlCreditsRemaining <= 0) {
        const err = ERROR_CODES.CRAWL_LIMIT_REACHED;
        throw new ServiceError("CRAWL_LIMIT_REACHED", err.status, err.message);
      }

      const existingLatest = await deps.crawls.getLatestByProject(
        args.projectId,
      );
      if (existingLatest && ACTIVE_STATUSES.has(existingLatest.status)) {
        const err = ERROR_CODES.CRAWL_IN_PROGRESS;
        throw new ServiceError("CRAWL_IN_PROGRESS", err.status, err.message);
      }

      const decremented = await deps.users.decrementCrawlCredits(args.userId);
      if (!decremented) {
        const err = ERROR_CODES.CRAWL_LIMIT_REACHED;
        throw new ServiceError("CRAWL_LIMIT_REACHED", err.status, err.message);
      }

      const crawlConfig = buildCrawlConfig(project, user.plan);
      const crawlJob = await deps.crawls.create({
        projectId: project.id,
        config: crawlConfig,
      });

      if (!args.env.crawlerUrl) {
        await deps.crawls.updateStatus(crawlJob.id, {
          status: "failed",
          errorMessage: "Crawler service is not yet available. Coming soon!",
        });
        return {
          ...crawlJob,
          status: "failed",
          errorMessage: "Crawler service is not yet available.",
        };
      }

      // Fast-fail if crawler is known-down
      if (args.env.kv) {
        const healthRaw = await args.env.kv.get("crawler:health:latest");
        if (healthRaw) {
          const health = JSON.parse(healthRaw);
          if (health.status === "down") {
            await deps.crawls.updateStatus(crawlJob.id, {
              status: "failed",
              errorMessage:
                "Crawler is currently down (detected by health check)",
            });
            throw new ServiceError(
              "CRAWLER_UNAVAILABLE",
              503,
              "Crawler service is temporarily unavailable. Please try again in a few minutes.",
            );
          }
        }
      }

      const callbackUrl = new URL("/ingest/batch", args.requestUrl).toString();
      const payload: CrawlJobPayload = {
        job_id: crawlJob.id,
        callback_url: callbackUrl,
        config: crawlConfig,
      };
      const payloadJson = JSON.stringify(payload);
      const { signature, timestamp } = await signPayload(
        args.env.sharedSecret,
        payloadJson,
      );

      try {
        console.log(
          `[crawl] dispatching to ${args.env.crawlerUrl}/api/v1/jobs`,
        );
        const response = await fetchWithRetry(
          `${args.env.crawlerUrl}/api/v1/jobs`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Signature": signature,
              "X-Timestamp": timestamp,
            },
            body: payloadJson,
          },
        );

        if (!response.ok) {
          const respBody = await response.text().catch(() => "");
          console.error(
            `[crawl] dispatch rejected: ${response.status} body=${respBody}`,
          );
          await deps.crawls.updateStatus(crawlJob.id, {
            status: "failed",
            errorMessage: `Crawler dispatch failed: ${response.status} ${response.statusText}`,
          });
          throw new ServiceError(
            "CRAWLER_REJECTED",
            502,
            "Crawler rejected the request",
          );
        }

        await deps.crawls.updateStatus(crawlJob.id, {
          status: "queued",
          startedAt: new Date(),
        });
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        console.error(
          `[crawl] dispatch error:`,
          error instanceof Error ? error.stack || error.message : String(error),
        );

        await deps.crawls.updateStatus(crawlJob.id, {
          status: "failed",
          errorMessage: `Crawler dispatch error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });

        const isTimeout = error instanceof Error && error.name === "AbortError";

        throw new ServiceError(
          isTimeout ? "CRAWLER_TIMEOUT" : "CRAWLER_UNAVAILABLE",
          isTimeout ? 504 : 503,
          "Crawler service is temporarily unavailable. Please try again in a few minutes.",
        );
      }

      return crawlJob;
    },

    async getCrawl(userId: string, crawlId: string) {
      const crawlJob = await deps.crawls.getById(crawlId);
      if (!crawlJob) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }

      const project = await assertProjectOwnership(
        deps.projects,
        userId,
        crawlJob.projectId,
      );
      const enriched = await enrichCrawlScores(crawlJob, deps.scores);
      return {
        ...enriched,
        projectName: project.name,
        summary: crawlJob.summary,
        summaryData: crawlJob.summaryData ?? null,
      };
    },

    async listProjectCrawls(userId: string, projectId: string) {
      await assertProjectOwnership(deps.projects, userId, projectId);
      return deps.crawls.listByProject(projectId);
    },

    async getQuickWins(userId: string, crawlId: string) {
      const crawlJob = await deps.crawls.getById(crawlId);
      if (!crawlJob) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertProjectOwnership(deps.projects, userId, crawlJob.projectId);
      const issues = await deps.scores.getIssuesByJob(crawlId);
      return getQuickWins(issues);
    },

    async getPlatformReadiness(userId: string, crawlId: string) {
      const crawlJob = await deps.crawls.getById(crawlId);
      if (!crawlJob) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertProjectOwnership(deps.projects, userId, crawlJob.projectId);

      const [issues, scores] = await Promise.all([
        deps.scores.getIssuesByJob(crawlId),
        deps.scores.listByJob(crawlId),
      ]);

      const issueCodes = new Set(issues.map((i) => i.code));
      const aggregate = aggregatePageScores(toAggregateInput(scores));

      const platformScores = calculatePlatformScores({
        technicalScore: aggregate.scores.technical,
        contentScore: aggregate.scores.content,
        aiReadinessScore: aggregate.scores.aiReadiness,
        performanceScore: aggregate.scores.performance,
      });

      return Object.entries(PLATFORM_REQUIREMENTS).map(([platform, checks]) => {
        const platformId = platform.toLowerCase() as LLMPlatformId;
        const scoreData = platformScores[platformId] || {
          score: 0,
          grade: "F",
          tips: [],
        };

        return {
          platform,
          score: scoreData.score,
          grade: scoreData.grade,
          tips: scoreData.tips,
          checks: checks.map((check) => ({
            factor: check.factor,
            label: check.label,
            importance: check.importance,
            pass: !issueCodes.has(check.issueCode),
          })),
        };
      });
    },

    async enableSharing(userId: string, crawlId: string) {
      const crawlJob = await deps.crawls.getById(crawlId);
      if (!crawlJob) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertProjectOwnership(deps.projects, userId, crawlJob.projectId);
      if (crawlJob.shareToken && crawlJob.shareEnabled) {
        return {
          shareToken: crawlJob.shareToken,
          shareUrl: `/report/${crawlJob.shareToken}`,
        };
      }
      const updated = await deps.crawls.generateShareToken(crawlId);
      return {
        shareToken: updated.shareToken,
        shareUrl: `/report/${updated.shareToken}`,
      };
    },

    async disableSharing(userId: string, crawlId: string) {
      const crawlJob = await deps.crawls.getById(crawlId);
      if (!crawlJob) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
      }
      await assertProjectOwnership(deps.projects, userId, crawlJob.projectId);
      await deps.crawls.disableSharing(crawlId);
      return { disabled: true };
    },

    async dispatchScheduledJobs(
      env: CrawlerDispatchEnv & { baseUrl?: string },
    ) {
      const projects = await deps.projects.getDueForCrawl(10);

      for (const project of projects) {
        if (!project.user) continue;

        const user = project.user as unknown as {
          id: string;
          plan: keyof typeof PLAN_LIMITS;
          crawlCreditsRemaining: number;
        };

        if (user.crawlCreditsRemaining <= 0) continue;

        // Decrement credits
        await deps.users.decrementCrawlCredits(user.id);

        // Create job
        const config = buildCrawlConfig(project, user.plan);
        const job = await deps.crawls.create({
          projectId: project.id,
          config,
        });

        // Dispatch via Queue (Scalable) or Direct Fetch (Legacy)
        if (env.queue) {
          await env.queue.send({
            job_id: job.id,
            config,
          });
          await deps.crawls.updateStatus(job.id, {
            status: "queued",
            startedAt: new Date(),
          });
        } else if (env.crawlerUrl) {
          const payload: CrawlJobPayload = {
            job_id: job.id,
            callback_url: `${env.crawlerUrl}/ingest/batch`,
            config,
          };

          const payloadJson = JSON.stringify(payload);
          const { signature, timestamp } = await signPayload(
            env.sharedSecret,
            payloadJson,
          );

          try {
            await fetchWithRetry(`${env.crawlerUrl}/api/v1/jobs`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Signature": signature,
                "X-Timestamp": timestamp,
              },
              body: payloadJson,
            });
            await deps.crawls.updateStatus(job.id, {
              status: "queued",
              startedAt: new Date(),
            });
          } catch (err) {
            await deps.crawls.updateStatus(job.id, {
              status: "failed",
              errorMessage: `Scheduled dispatch error: ${err instanceof Error ? err.message : "Unknown error"}`,
            });
          }
        }

        // Update next run
        const nextDate = new Date();
        switch (project.crawlSchedule) {
          case "daily":
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        }
        await deps.projects.updateNextCrawl(project.id, nextDate);
      }
    },
  };
}

export function buildCrawlConfig(
  project: { domain: string; settings: unknown },
  plan: keyof typeof PLAN_LIMITS,
) {
  const limits = PLAN_LIMITS[plan];
  const settings = (project.settings as Record<string, unknown>) ?? {};
  const maxPages = Math.min(
    (settings.maxPages as number) || limits.pagesPerCrawl,
    limits.pagesPerCrawl,
  );
  const maxDepth = Math.min(
    (settings.maxDepth as number) || limits.maxCrawlDepth,
    limits.maxCrawlDepth,
  );

  return {
    seed_urls: [project.domain],
    max_pages: maxPages,
    max_depth: maxDepth,
    respect_robots: true,
    run_lighthouse: true,
    extract_schema: true,
    extract_links: true,
    check_llms_txt: true,
    user_agent: "AISEOBot/1.0",
    rate_limit_ms: 1000,
    timeout_s: 30,
    custom_extractors: [],
  };
}

async function enrichCrawlScores(
  crawlJob: Awaited<ReturnType<CrawlRepository["getById"]>>,
  scores: ScoreRepository,
) {
  if (!crawlJob) return null;
  if (crawlJob.status !== "complete") {
    return {
      ...crawlJob,
      overallScore: null,
      letterGrade: null,
      scores: null,
    };
  }

  const rows = await scores.listByJob(crawlJob.id);
  if (rows.length === 0) {
    return {
      ...crawlJob,
      overallScore: null,
      letterGrade: null,
      scores: null,
    };
  }

  return {
    ...crawlJob,
    ...aggregatePageScores(toAggregateInput(rows)),
  };
}
