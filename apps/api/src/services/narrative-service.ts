import { ServiceError } from "@llm-boost/shared";
import { NarrativeEngine } from "@llm-boost/narrative";
import type { NarrativeInput } from "@llm-boost/narrative";
import type { NarrativeSectionType, NarrativeTone } from "@llm-boost/shared";
import type {
  NarrativeRepository,
  ProjectRepository,
  UserRepository,
  CrawlRepository,
} from "@llm-boost/repositories";

interface Deps {
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
      // 1. Verify crawl exists and is complete
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }

      // 2. Verify project ownership
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

      // 3. Check plan — Pro or Agency only
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

      // 4. Check if already exists for this crawl+tone
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

      // 5. Create record
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

      // 6. Generate
      const model = getModelForPlan(user.plan);
      const engine = new NarrativeEngine({
        anthropicApiKey: env.anthropicApiKey,
        model,
      });

      await deps.narratives.updateStatus(record.id, "generating");

      try {
        const narrativeInput = buildNarrativeInput(crawl, tone);
        const result = await engine.generate(narrativeInput);

        await deps.narratives.updateStatus(record.id, "ready", {
          sections: result.sections as any,
          generatedBy: result.generatedBy,
          tokenUsage: result.tokenUsage as any,
        });

        return {
          ...record,
          status: "ready" as const,
          sections: result.sections,
        };
      } catch {
        await deps.narratives.updateStatus(record.id, "failed");
        throw new ServiceError(
          "GENERATION_FAILED",
          502,
          "Narrative generation failed",
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
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Narrative not found");
      }
      return narrative;
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

      // Agency only
      const user = await deps.users.getById(userId);
      if (!user || user.plan !== "agency") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Editing narratives requires an Agency plan",
        );
      }

      // Find the narrative that contains this section
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

      // Find the existing narrative
      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        "technical",
      );
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Narrative not found");
      }

      // Always use Sonnet for regeneration with instructions
      const model = instructions
        ? "claude-sonnet-4-6"
        : getModelForPlan(user.plan);

      const engine = new NarrativeEngine({
        anthropicApiKey: env.anthropicApiKey,
        model,
      });

      const narrativeInput = buildNarrativeInput(crawl, narrative.tone);
      const newSection = await engine.regenerateSection(
        sectionType,
        narrativeInput,
        instructions,
      );

      // Replace the section in the array
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

// Helper: build NarrativeInput from crawl data
function buildNarrativeInput(crawl: any, tone: NarrativeTone): NarrativeInput {
  const summary = crawl.summaryData ?? {};
  return {
    tone,
    crawlJob: {
      id: crawl.id,
      domain: summary.domain ?? crawl.domain ?? "unknown",
      overallScore: summary.overallScore ?? 0,
      letterGrade: summary.letterGrade ?? "F",
      pagesScored: crawl.pagesScored ?? 0,
      categoryScores: summary.categoryScores ?? {
        technical: 0,
        content: 0,
        aiReadiness: 0,
        performance: 0,
      },
    },
    categoryScores: summary.categoryScores ?? {
      technical: 0,
      content: 0,
      aiReadiness: 0,
      performance: 0,
    },
    issues: summary.issues ?? [],
    quickWins: summary.quickWins ?? [],
    contentHealth: summary.contentHealth ?? {
      avgWordCount: 0,
      avgClarity: 0,
      avgAuthority: 0,
      avgComprehensiveness: 0,
      avgStructure: 0,
      avgCitationWorthiness: 0,
    },
    previousCrawl: summary.previousCrawl,
    competitors: summary.competitors,
    pages: summary.topPages ?? [],
  };
}
