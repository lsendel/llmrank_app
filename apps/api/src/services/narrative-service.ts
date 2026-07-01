import {
  competitorQueries,
  crawlQueries,
  personaQueries,
  promptTemplates,
  savedKeywordQueries,
  scoreQueries,
  type AppDatabase,
  type AdminDatabase,
} from "@llm-boost/db";
import { PromptResolver } from "@llm-boost/llm";
import {
  NarrativeEngine,
  NARRATIVE_PROMPT_SLUGS,
  buildNarrativePromptVariables,
  getNarrativePromptFallbacks,
  type NarrativeInput,
  type NarrativeResolvedPrompt,
} from "@llm-boost/narrative";
import type { NarrativeSectionType, NarrativeTone } from "@llm-boost/shared";
import { ServiceError, getQuickWins, letterGrade } from "@llm-boost/shared";
import type {
  CrawlRepository,
  NarrativeRepository,
  ProjectRepository,
  UserRepository,
} from "@llm-boost/repositories";
import { trackLlmUsage } from "../lib/llm-usage-tracker";

interface Deps {
  db: AppDatabase;
  adminDb: AdminDatabase;
  narratives: NarrativeRepository;
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
}

interface NarrativeEnv {
  anthropicApiKey: string;
}

function getModelForPlan(plan: string): string {
  return plan === "agency" ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
}

export function createNarrativeService(deps: Deps) {
  return {
    async generate(
      userId: string,
      crawlJobId: string,
      tone: NarrativeTone,
      env: NarrativeEnv,
    ) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      if (crawl.status !== "complete") {
        throw new ServiceError(
          "INVALID_STATE",
          409,
          "Crawl must be complete before generating a narrative",
        );
      }

      const user = await deps.users.getById(userId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", 404, "User not found");
      }
      if (user.plan !== "pro" && user.plan !== "agency") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "AI narrative reports require a Pro or Agency plan",
        );
      }
      if (!env.anthropicApiKey) {
        throw new ServiceError(
          "CONFIGURATION_ERROR",
          503,
          "AI analysis is not configured",
        );
      }

      const existing = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        tone,
      );
      if (existing && existing.status === "generating") {
        throw new ServiceError(
          "CONFLICT",
          409,
          "Narrative generation already in progress",
        );
      }

      const version =
        (await deps.narratives.getLatestVersion(crawlJobId, tone)) + 1;
      const record = await deps.narratives.create({
        crawlJobId,
        projectId: crawl.projectId,
        tone,
        status: "pending",
        version,
        sections: [],
      });

      const defaultModel = getModelForPlan(user.plan);
      await deps.narratives.updateStatus(record.id, "generating");

      try {
        const narrativeInput = await buildNarrativeInput(
          deps.db,
          crawl,
          project,
          tone,
        );
        const sectionPrompts = await resolveNarrativeSectionPrompts(
          deps.adminDb,
          narrativeInput,
          defaultModel,
        );
        const engine = new NarrativeEngine({
          anthropicApiKey: env.anthropicApiKey,
          model: defaultModel,
          sectionPrompts,
        });
        const result = await engine.generate(narrativeInput);

        await trackLlmUsage(deps.db, {
          feature: "narrative",
          model: defaultModel,
          inputTokens: result.tokenUsage.input,
          outputTokens: result.tokenUsage.output,
          userId,
          projectId: crawl.projectId,
          plan: user.plan,
        });

        await deps.narratives.updateStatus(record.id, "ready", {
          sections: result.sections as any,
          generatedBy: result.generatedBy,
          tokenUsage: result.tokenUsage as any,
        });

        return {
          ...record,
          status: "ready" as const,
          sections: result.sections,
          generatedBy: result.generatedBy,
          tokenUsage: result.tokenUsage,
        };
      } catch (error) {
        await deps.narratives.updateStatus(record.id, "failed");
        throw new ServiceError(
          "GENERATION_FAILED",
          502,
          error instanceof Error
            ? error.message
            : "Narrative generation failed",
        );
      }
    },

    async get(userId: string, crawlJobId: string, tone: NarrativeTone) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        tone,
      );
      return narrative ?? null;
    },

    async editSection(
      userId: string,
      crawlJobId: string,
      sectionId: string,
      editedContent: string | null,
    ) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const user = await deps.users.getById(userId);
      if (!user || user.plan !== "agency") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Editing narratives requires an Agency plan",
        );
      }

      const narratives = await deps.narratives.listByProject(
        crawl.projectId,
        50,
      );
      const narrative = narratives.find((n) =>
        (n.sections as any[])?.some((s: any) => s.id === sectionId),
      );
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Section not found");
      }

      const updatedSections = (narrative.sections as any[]).map((s: any) =>
        s.id === sectionId ? { ...s, editedContent } : s,
      );

      return deps.narratives.updateSections(narrative.id, updatedSections);
    },

    async regenerateSection(
      userId: string,
      crawlJobId: string,
      tone: NarrativeTone,
      sectionType: NarrativeSectionType,
      instructions: string | undefined,
      env: NarrativeEnv,
    ) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const user = await deps.users.getById(userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");
      if (!env.anthropicApiKey) {
        throw new ServiceError(
          "CONFIGURATION_ERROR",
          503,
          "AI analysis is not configured",
        );
      }

      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        tone,
      );
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Narrative not found");
      }

      const defaultModel = instructions
        ? "claude-sonnet-4-6"
        : getModelForPlan(user.plan);
      const narrativeInput = await buildNarrativeInput(
        deps.db,
        crawl,
        project,
        narrative.tone as "technical" | "business",
      );
      const sectionPrompts = await resolveNarrativeSectionPrompts(
        deps.adminDb,
        narrativeInput,
        defaultModel,
      );
      const engine = new NarrativeEngine({
        anthropicApiKey: env.anthropicApiKey,
        model: defaultModel,
        sectionPrompts,
        onUsage: (usage) =>
          trackLlmUsage(deps.db, {
            feature: "narrative_regenerate",
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            userId,
            projectId: crawl.projectId,
            plan: user.plan,
          }),
      });

      let newSection;
      try {
        newSection = await engine.regenerateSection(
          sectionType,
          narrativeInput,
          instructions,
        );
      } catch (err) {
        if (err instanceof ServiceError) throw err;
        // Any regeneration failure (empty/non-text response, provider error)
        // must NOT overwrite the existing section — keep it, let the user retry.
        throw new ServiceError(
          "AI_UNAVAILABLE",
          503,
          "Section regeneration failed — your existing section was kept. Please try again.",
        );
      }

      const updatedSections = (narrative.sections as any[]).map((s: any) =>
        s.type === sectionType ? newSection : s,
      );

      await deps.narratives.updateSections(narrative.id, updatedSections);
      return newSection;
    },

    async delete(userId: string, crawlJobId: string) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        "technical",
      );
      if (narrative) await deps.narratives.delete(narrative.id);

      const businessNarrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        "business",
      );
      if (businessNarrative) await deps.narratives.delete(businessNarrative.id);
    },
  };
}

async function resolveNarrativeSectionPrompts(
  db: AdminDatabase,
  input: NarrativeInput,
  defaultModel: string,
): Promise<Partial<Record<NarrativeSectionType, NarrativeResolvedPrompt>>> {
  const resolver = new PromptResolver(
    db,
    promptTemplates,
    getNarrativePromptFallbacks(),
  );

  const entries = await Promise.all(
    (Object.keys(NARRATIVE_PROMPT_SLUGS) as NarrativeSectionType[]).map(
      async (sectionType) => {
        const variables = buildNarrativePromptVariables(sectionType, input);
        const resolved = await resolver.resolve(
          NARRATIVE_PROMPT_SLUGS[sectionType],
          variables,
        );

        return [
          sectionType,
          {
            system: ensureToneAdapter(resolved.system, variables.toneAdapter),
            user: resolved.user,
            model: resolved.promptId ? resolved.model : defaultModel,
            maxTokens: resolved.config?.maxTokens ?? 1024,
            temperature: resolved.config?.temperature,
            promptId: resolved.promptId,
          } satisfies NarrativeResolvedPrompt,
        ] as const;
      },
    ),
  );

  return Object.fromEntries(entries);
}

function ensureToneAdapter(systemPrompt: string, toneAdapter: string): string {
  if (!systemPrompt.trim()) return toneAdapter;
  if (systemPrompt.includes(toneAdapter.trim())) return systemPrompt;
  return `${systemPrompt}\n\n${toneAdapter}`;
}

async function buildNarrativeInput(
  db: AppDatabase,
  crawl: any,
  project: any,
  tone: NarrativeTone,
): Promise<NarrativeInput> {
  const scoreRepo = scoreQueries(db);
  const crawlRepo = crawlQueries(db);

  const [
    pageScoresWithPages,
    issueRows,
    trackedKeywords,
    personas,
    trackedCompetitors,
    previousCompletedCrawls,
  ] = await Promise.all([
    scoreRepo.listByJobWithPages(crawl.id, { limit: 5000 }),
    scoreRepo.getIssuesByJob(crawl.id),
    savedKeywordQueries(db).listByProject(project.id),
    personaQueries(db).listByProject(project.id),
    competitorQueries(db).listByProject(project.id),
    crawlRepo.listCompletedByProject(project.id, 3),
  ]);

  const summary = (crawl.summaryData as Record<string, any> | null) ?? null;
  const categoryScores =
    summary?.categoryScores ?? deriveCategoryScores(pageScoresWithPages);
  const overallScore =
    typeof summary?.overallScore === "number"
      ? summary.overallScore
      : round(
          average(pageScoresWithPages.map((row: any) => row.overallScore ?? 0)),
        );
  const pagesScored =
    typeof summary?.pagesScored === "number"
      ? summary.pagesScored
      : pageScoresWithPages.length;
  const issueSummaries = summarizeIssues(issueRows);
  const quickWins = getQuickWins(issueRows).map((win) => ({
    code: win.code,
    message: win.message,
    recommendation: win.recommendation,
    scoreImpact: win.scoreImpact,
    pillar: win.category,
  }));

  const previousCrawl = previousCompletedCrawls.find(
    (candidate: any) => candidate.id !== crawl.id,
  );

  return {
    tone,
    crawlJob: {
      id: crawl.id,
      domain:
        summary?.project?.domain ??
        project.domain ??
        summary?.domain ??
        "unknown",
      overallScore,
      letterGrade: summary?.letterGrade ?? letterGrade(overallScore),
      pagesScored,
      categoryScores,
    },
    categoryScores,
    issues: issueSummaries,
    quickWins,
    contentHealth: buildContentHealth(pageScoresWithPages),
    projectContext: {
      name: project.name,
      siteDescription: project.siteDescription ?? null,
      industry: project.industry ?? null,
      businessGoal: project.businessGoal ?? null,
      siteContext: summary?.siteContext ?? crawl.siteContext ?? null,
    },
    trackedKeywords: trackedKeywords
      .map((row: any) => row.keyword)
      .slice(0, 20),
    trackedCompetitors: trackedCompetitors
      .map((row: any) => row.domain)
      .slice(0, 10),
    personas: personas.slice(0, 5).map((persona: any) => ({
      name: persona.name,
      role: persona.role,
      jobToBeDone: persona.jobToBeDone ?? null,
      sampleQueries: Array.isArray(persona.sampleQueries)
        ? persona.sampleQueries.slice(0, 5)
        : [],
    })),
    previousCrawl: previousCrawl
      ? summarizePreviousCrawl(previousCrawl, project.domain)
      : undefined,
    competitors: Array.isArray(summary?.competitors)
      ? summary.competitors
      : trackedCompetitors.slice(0, 10).map((row: any) => ({
          domain: row.domain,
          mentionCount: 0,
          platforms: [],
          queries: [],
        })),
    pages: buildTopPages(pageScoresWithPages),
  };
}

function summarizeIssues(issueRows: any[]) {
  const grouped = new Map<
    string,
    {
      code: string;
      category: string;
      severity: string;
      message: string;
      recommendation: string;
      pageIds: Set<string>;
      scoreImpact: number;
    }
  >();

  for (const issue of issueRows) {
    const existing = grouped.get(issue.code);
    const pageKey = issue.pageId ?? issue.pageUrl ?? crypto.randomUUID();
    if (existing) {
      existing.pageIds.add(pageKey);
      continue;
    }

    grouped.set(issue.code, {
      code: issue.code,
      category: issue.category,
      severity: issue.severity,
      message: issue.message,
      recommendation: issue.recommendation ?? "",
      pageIds: new Set([pageKey]),
      scoreImpact: 0,
    });
  }

  return Array.from(grouped.values())
    .map((issue) => ({
      code: issue.code,
      category: issue.category,
      severity: issue.severity,
      message: issue.message,
      recommendation: issue.recommendation,
      affectedPages: issue.pageIds.size,
      scoreImpact: issue.scoreImpact,
    }))
    .sort((left, right) => right.affectedPages - left.affectedPages)
    .slice(0, 20);
}

function buildContentHealth(pageScoresWithPages: any[]) {
  const llmScores = pageScoresWithPages
    .map((row) => row.detail?.llmContentScores)
    .filter(Boolean);
  const wordCounts = pageScoresWithPages.map((row) => row.page?.wordCount ?? 0);

  return {
    avgWordCount: Math.round(average(wordCounts)),
    avgClarity: round(
      average(llmScores.map((score: any) => score.clarity ?? 0)),
    ),
    avgAuthority: round(
      average(llmScores.map((score: any) => score.authority ?? 0)),
    ),
    avgComprehensiveness: round(
      average(llmScores.map((score: any) => score.comprehensiveness ?? 0)),
    ),
    avgStructure: round(
      average(llmScores.map((score: any) => score.structure ?? 0)),
    ),
    avgCitationWorthiness: round(
      average(llmScores.map((score: any) => score.citation_worthiness ?? 0)),
    ),
  };
}

function buildTopPages(pageScoresWithPages: any[]) {
  return [...pageScoresWithPages]
    .sort((left, right) => (right.overallScore ?? 0) - (left.overallScore ?? 0))
    .slice(0, 10)
    .map((row) => ({
      url: row.page?.url ?? "",
      title: row.page?.title ?? row.page?.url ?? "Untitled page",
      overallScore: round(row.overallScore ?? 0),
      letterGrade: letterGrade(row.overallScore ?? 0),
      issueCount: row.issueCount ?? 0,
    }));
}

function summarizePreviousCrawl(previousCrawl: any, fallbackDomain: string) {
  const summary =
    (previousCrawl.summaryData as Record<string, any> | null) ?? null;
  const categoryScores =
    summary?.categoryScores ??
    deriveCategoryScores(
      [] as Array<{ technicalScore?: number; contentScore?: number }>,
    );
  const overallScore =
    typeof summary?.overallScore === "number" ? summary.overallScore : 0;

  return {
    id: previousCrawl.id,
    domain: summary?.project?.domain ?? fallbackDomain,
    overallScore,
    letterGrade: summary?.letterGrade ?? letterGrade(overallScore),
    pagesScored:
      typeof summary?.pagesScored === "number"
        ? summary.pagesScored
        : (previousCrawl.pagesScored ?? 0),
    categoryScores,
  };
}

function deriveCategoryScores(
  pageScoresWithPages: Array<{
    technicalScore?: number | null;
    contentScore?: number | null;
    aiReadinessScore?: number | null;
    lighthousePerf?: number | null;
  }>,
) {
  return {
    technical: round(
      average(pageScoresWithPages.map((row) => row.technicalScore ?? 0)),
    ),
    content: round(
      average(pageScoresWithPages.map((row) => row.contentScore ?? 0)),
    ),
    aiReadiness: round(
      average(pageScoresWithPages.map((row) => row.aiReadinessScore ?? 0)),
    ),
    performance: round(
      average(
        pageScoresWithPages.map((row) =>
          typeof row.lighthousePerf === "number" ? row.lighthousePerf * 100 : 0,
        ),
      ),
    ),
  };
}

function average(values: number[]) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length === 0) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
