import { averageScores, letterGrade } from "@llm-boost/shared";
import type {
  CrawlRepository,
  ProjectRepository,
  ScoreRepository,
  PageRepository,
} from "@llm-boost/repositories";
import { assertProjectOwnership } from "./shared/assert-ownership";

export interface ProgressServiceDeps {
  crawls: CrawlRepository;
  projects: ProjectRepository;
  scores: ScoreRepository;
  pages: PageRepository;
}

export function createProgressService(deps: ProgressServiceDeps) {
  return {
    async getProjectProgress(userId: string, projectId: string) {
      await assertProjectOwnership(deps.projects, userId, projectId);

      // Get last two completed crawls
      const allCrawls = await deps.crawls.listByProject(projectId);
      const completedCrawls = allCrawls
        .filter((c: any) => c.status === "complete")
        .slice(0, 2); // already sorted desc by createdAt

      if (completedCrawls.length < 2) return null;

      const [current, previous] = completedCrawls;

      // Parallel fetch: scores, issues, and pages for both crawls
      const [
        currentScores,
        previousScores,
        currentIssues,
        previousIssues,
        currentPages,
        previousPages,
      ] = await Promise.all([
        deps.scores.listByJob(current.id),
        deps.scores.listByJob(previous.id),
        deps.scores.getIssuesByJob(current.id),
        deps.scores.getIssuesByJob(previous.id),
        deps.pages.listByJob(current.id),
        deps.pages.listByJob(previous.id),
      ]);

      // Build URL→score maps for matching pages across crawls
      const currentPageUrlMap = new Map(
        currentPages.map((p: any) => [p.id, p.url]),
      );
      const previousPageUrlMap = new Map(
        previousPages.map((p: any) => [p.id, p.url]),
      );

      const currentScoreByUrl = new Map<string, any>();
      for (const s of currentScores) {
        const url = currentPageUrlMap.get(s.pageId);
        if (url) currentScoreByUrl.set(url, s);
      }

      const previousScoreByUrl = new Map<string, any>();
      for (const s of previousScores) {
        const url = previousPageUrlMap.get(s.pageId);
        if (url) previousScoreByUrl.set(url, s);
      }

      // Compute overall score averages
      const currentAvg = averageScores(
        currentScores.map((s: any) => s.overallScore),
      );
      const previousAvg = averageScores(
        previousScores.map((s: any) => s.overallScore),
      );

      // Category averages
      const catAvg = (scores: any[], field: string) =>
        averageScores(
          scores.map((s: any) => s[field]).filter((v: any) => v != null),
        );

      const categoryDeltas = {
        technical: {
          current: catAvg(currentScores, "technicalScore"),
          previous: catAvg(previousScores, "technicalScore"),
          delta:
            catAvg(currentScores, "technicalScore") -
            catAvg(previousScores, "technicalScore"),
        },
        content: {
          current: catAvg(currentScores, "contentScore"),
          previous: catAvg(previousScores, "contentScore"),
          delta:
            catAvg(currentScores, "contentScore") -
            catAvg(previousScores, "contentScore"),
        },
        aiReadiness: {
          current: catAvg(currentScores, "aiReadinessScore"),
          previous: catAvg(previousScores, "aiReadinessScore"),
          delta:
            catAvg(currentScores, "aiReadinessScore") -
            catAvg(previousScores, "aiReadinessScore"),
        },
        performance: {
          current:
            catAvg(currentScores, "lighthousePerf") != null
              ? Math.round(catAvg(currentScores, "lighthousePerf") || 0)
              : 0,
          previous:
            catAvg(previousScores, "lighthousePerf") != null
              ? Math.round(catAvg(previousScores, "lighthousePerf") || 0)
              : 0,
          delta: 0,
        },
      };
      categoryDeltas.performance.delta =
        categoryDeltas.performance.current -
        categoryDeltas.performance.previous;

      // Issue tracking: match by issue code + URL across crawls
      const previousIssuesByUrl = new Map<string, Set<string>>();
      for (const issue of previousIssues) {
        const url = previousPageUrlMap.get(issue.pageId);
        if (!url) continue;
        if (!previousIssuesByUrl.has(url))
          previousIssuesByUrl.set(url, new Set());
        previousIssuesByUrl.get(url)!.add(issue.code);
      }

      const currentIssuesByUrl = new Map<string, Set<string>>();
      for (const issue of currentIssues) {
        const url = currentPageUrlMap.get(issue.pageId);
        if (!url) continue;
        if (!currentIssuesByUrl.has(url))
          currentIssuesByUrl.set(url, new Set());
        currentIssuesByUrl.get(url)!.add(issue.code);
      }

      // Flatten all unique issue codes per crawl (global)
      const allPreviousCodes = new Set<string>();
      for (const codes of previousIssuesByUrl.values()) {
        for (const c of codes) allPreviousCodes.add(c);
      }
      const allCurrentCodes = new Set<string>();
      for (const codes of currentIssuesByUrl.values()) {
        for (const c of codes) allCurrentCodes.add(c);
      }

      // Count issue instances (code@url pairs) for fixed/new/persisting
      let issuesFixed = 0;
      let issuesNew = 0;
      let issuesPersisting = 0;

      // Check each URL that exists in previous crawl
      const allUrls = new Set([
        ...previousIssuesByUrl.keys(),
        ...currentIssuesByUrl.keys(),
      ]);
      for (const url of allUrls) {
        const prev = previousIssuesByUrl.get(url) ?? new Set();
        const curr = currentIssuesByUrl.get(url) ?? new Set();
        for (const code of prev) {
          if (curr.has(code)) issuesPersisting++;
          else issuesFixed++;
        }
        for (const code of curr) {
          if (!prev.has(code)) issuesNew++;
        }
      }

      // Grade changes: compare matched pages
      let improved = 0;
      let regressed = 0;
      let unchanged = 0;

      const pageDeltas: { url: string; delta: number; current: number }[] = [];

      for (const [url, currScore] of currentScoreByUrl) {
        const prevScore = previousScoreByUrl.get(url);
        if (!prevScore) continue;
        const d = currScore.overallScore - prevScore.overallScore;
        pageDeltas.push({ url, delta: d, current: currScore.overallScore });

        const currGrade = letterGrade(currScore.overallScore);
        const prevGrade = letterGrade(prevScore.overallScore);
        if (currGrade < prevGrade)
          improved++; // A < B alphabetically
        else if (currGrade > prevGrade) regressed++;
        else unchanged++;
      }

      // Sort for top improved / regressed
      const sorted = [...pageDeltas].sort((a, b) => b.delta - a.delta);
      const topImproved = sorted.filter((p) => p.delta > 0).slice(0, 5);
      const topRegressed = sorted.filter((p) => p.delta < 0).slice(0, 5);

      // Velocity: average score improvement across all completed crawls
      // Simplified: (current - previous) / 1 = delta per crawl
      const velocity = Math.round((currentAvg - previousAvg) * 10) / 10;

      return {
        currentCrawlId: current.id,
        previousCrawlId: previous.id,
        scoreDelta: currentAvg - previousAvg,
        currentScore: currentAvg,
        previousScore: previousAvg,
        categoryDeltas,
        issuesFixed,
        issuesNew,
        issuesPersisting,
        gradeChanges: { improved, regressed, unchanged },
        velocity,
        topImprovedPages: topImproved,
        topRegressedPages: topRegressed,
      };
    },
  };
}
