import { Hono } from "hono";
import type { AppEnv } from "../../index";
import {
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
} from "@llm-boost/repositories";
import { handleServiceError } from "../../lib/error-handler";
import { crawlQueries, scoreQueries } from "@llm-boost/db";
import { PLATFORM_REQUIREMENTS } from "@llm-boost/shared";
import { resolveLocaleForPlan } from "../../lib/visibility-locale";

export const visibilityRecommendationRoutes = new Hono<AppEnv>();

visibilityRecommendationRoutes.get("/:projectId/recommendations", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const user = await createUserRepository(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const localeResolution = resolveLocaleForPlan({
    plan: user.plan,
    region: c.req.query("region") || undefined,
    language: c.req.query("language") || undefined,
  });
  if ("error" in localeResolution) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: localeResolution.error,
        },
      },
      422,
    );
  }

  try {
    const project = await createProjectRepository(db).getById(projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const checks = await createVisibilityRepository(db).listByProject(
      projectId,
      localeResolution.locale,
    );

    const queryMap = new Map<
      string,
      { userMentioned: boolean; competitorsCited: Array<{ domain: string }> }
    >();
    for (const check of checks) {
      const entry = queryMap.get(check.query) ?? {
        userMentioned: false,
        competitorsCited: [],
      };
      if (check.brandMentioned) entry.userMentioned = true;
      const mentions = (check.competitorMentions ?? []) as Array<{
        domain: string;
        mentioned: boolean;
      }>;
      for (const mention of mentions) {
        if (
          mention.mentioned &&
          !entry.competitorsCited.some((competitor) => competitor.domain === mention.domain)
        ) {
          entry.competitorsCited.push({ domain: mention.domain });
        }
      }
      queryMap.set(check.query, entry);
    }

    const gaps = [...queryMap.entries()]
      .filter(([, value]) => !value.userMentioned && value.competitorsCited.length > 0)
      .map(([query, value]) => ({ query, competitorsCited: value.competitorsCited }));

    const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
    const platformFailures: Array<{
      platform: string;
      label: string;
      issueCode: string;
      importance: "critical" | "important" | "recommended";
    }> = [];
    const issueCodes = new Set<string>();
    if (latestCrawl) {
      const issues = await scoreQueries(db).getIssuesByJob(latestCrawl.id);
      issues.forEach((issue) => issueCodes.add(issue.code));
      for (const [platform, platformChecks] of Object.entries(PLATFORM_REQUIREMENTS)) {
        for (const platformCheck of platformChecks) {
          if (issueCodes.has(platformCheck.issueCode)) {
            platformFailures.push({ platform, ...platformCheck });
          }
        }
      }
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const providerTrends: Array<{
      provider: string;
      currentRate: number;
      previousRate: number;
    }> = [];
    const providers = new Set(checks.map((check) => check.llmProvider));
    for (const provider of providers) {
      const current = checks.filter(
        (check) =>
          check.llmProvider === provider && new Date(check.checkedAt) >= oneWeekAgo,
      );
      const previous = checks.filter(
        (check) =>
          check.llmProvider === provider &&
          new Date(check.checkedAt) >= twoWeeksAgo &&
          new Date(check.checkedAt) < oneWeekAgo,
      );
      if (current.length > 0 && previous.length > 0) {
        providerTrends.push({
          provider,
          currentRate:
            current.filter((check) => check.brandMentioned).length / current.length,
          previousRate:
            previous.filter((check) => check.brandMentioned).length / previous.length,
        });
      }
    }

    const { generateRecommendations } =
      await import("@llm-boost/pipeline");
    const recommendations = generateRecommendations({
      gaps,
      platformFailures,
      issueCodesPresent: issueCodes,
      trends: providerTrends,
      providersUsed: providers,
      projectId,
    });

    return c.json({ data: recommendations });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
