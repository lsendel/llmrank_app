import { Hono } from "hono";
import type { AppEnv } from "../../index";
import {
  createCompetitorRepository,
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
} from "@llm-boost/repositories";
import { createVisibilityService } from "@llm-boost/pipeline";
import { handleServiceError } from "../../lib/error-handler";
import { computeAIVisibilityScore } from "@llm-boost/scoring";
import { discoveredLinkQueries } from "@llm-boost/db";
import { resolveLocaleForPlan } from "../../lib/visibility-locale";

export const visibilityScoreRoutes = new Hono<AppEnv>();

visibilityScoreRoutes.get("/:projectId/ai-score", async (c) => {
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

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const checks = await service.listForProject(
      userId,
      projectId,
      localeResolution.locale,
    );
    const project = await createProjectRepository(db).getById(projectId);
    if (!project) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const llmChecks = checks.filter((check) => check.llmProvider !== "gemini_ai_mode");
    const llmMentionRate =
      llmChecks.length > 0
        ? llmChecks.filter((check) => check.brandMentioned).length / llmChecks.length
        : 0;

    const aiChecks = checks.filter((check) => check.llmProvider === "gemini_ai_mode");
    const aiSearchPresenceRate =
      aiChecks.length > 0
        ? aiChecks.filter((check) => check.brandMentioned).length / aiChecks.length
        : 0;

    let totalCompetitorMentions = 0;
    const totalUserMentions = llmChecks.filter((check) => check.brandMentioned).length;
    for (const check of llmChecks) {
      const mentions = (check.competitorMentions ?? []) as Array<{ mentioned: boolean }>;
      totalCompetitorMentions += mentions.filter((mention) => mention.mentioned).length;
    }
    const totalMentions = totalUserMentions + totalCompetitorMentions;
    const shareOfVoice = totalMentions > 0 ? totalUserMentions / totalMentions : 0;

    const blSummary = await discoveredLinkQueries(db).getSummary(project.domain);
    const backlinkAuthoritySignal = Math.min(1, blSummary.referringDomains / 50);

    const score = computeAIVisibilityScore({
      llmMentionRate,
      aiSearchPresenceRate,
      shareOfVoice,
      backlinkAuthoritySignal,
    });

    return c.json({
      data: {
        ...score,
        meta: {
          totalChecks: checks.length,
          llmChecks: llmChecks.length,
          aiModeChecks: aiChecks.length,
          referringDomains: blSummary.referringDomains,
        },
      },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

visibilityScoreRoutes.get("/:projectId/ai-score/trend", async (c) => {
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

  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  try {
    const checks = await service.listForProject(
      userId,
      projectId,
      localeResolution.locale,
    );
    const project = await createProjectRepository(db).getById(projectId);
    if (!project) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentChecks = checks.filter((check) => new Date(check.checkedAt) >= oneWeekAgo);
    const previousChecks = checks.filter(
      (check) =>
        new Date(check.checkedAt) >= twoWeeksAgo &&
        new Date(check.checkedAt) < oneWeekAgo,
    );

    function computeInputs(subset: typeof checks): import("@llm-boost/scoring").AIVisibilityInput {
      const llm = subset.filter((check) => check.llmProvider !== "gemini_ai_mode");
      const ai = subset.filter((check) => check.llmProvider === "gemini_ai_mode");
      const llmMentionRate =
        llm.length > 0
          ? llm.filter((check) => check.brandMentioned).length / llm.length
          : 0;
      const aiSearchPresenceRate =
        ai.length > 0
          ? ai.filter((check) => check.brandMentioned).length / ai.length
          : 0;
      const userMentions = llm.filter((check) => check.brandMentioned).length;
      let competitorMentions = 0;
      for (const check of llm) {
        const mentions = (check.competitorMentions ?? []) as Array<{ mentioned: boolean }>;
        competitorMentions += mentions.filter((mention) => mention.mentioned).length;
      }
      const totalMentions = userMentions + competitorMentions;

      return {
        llmMentionRate,
        aiSearchPresenceRate,
        shareOfVoice: totalMentions > 0 ? userMentions / totalMentions : 0,
        backlinkAuthoritySignal: 0,
      };
    }

    const blSummary = await discoveredLinkQueries(db).getSummary(project.domain);
    const backlinkAuthoritySignal = Math.min(1, blSummary.referringDomains / 50);

    const current = computeAIVisibilityScore({
      ...computeInputs(currentChecks),
      backlinkAuthoritySignal,
    });
    const previous =
      previousChecks.length > 0
        ? computeAIVisibilityScore({
            ...computeInputs(previousChecks),
            backlinkAuthoritySignal,
          })
        : null;

    const delta = previous ? current.overall - previous.overall : 0;
    const aiAdoptionRate = 0.2;
    const baseMonthlySearchesPerQuery = 500;

    function estimateAudience(subset: typeof checks): number {
      const mentionedQueries = new Set<string>();
      for (const check of subset) {
        if (check.brandMentioned) mentionedQueries.add(check.query);
      }
      return Math.round(
        mentionedQueries.size * baseMonthlySearchesPerQuery * aiAdoptionRate,
      );
    }

    const currentAudience = estimateAudience(currentChecks);
    const previousAudience = estimateAudience(previousChecks);
    const audienceGrowth =
      previousAudience > 0
        ? Math.round(((currentAudience - previousAudience) / previousAudience) * 100)
        : 0;

    return c.json({
      data: {
        current,
        previous,
        delta,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "stable",
        period: "weekly",
        meta: {
          currentChecks: currentChecks.length,
          previousChecks: previousChecks.length,
          referringDomains: blSummary.referringDomains,
          estimatedMonthlyAudience: currentAudience,
          audienceGrowth,
        },
      },
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
