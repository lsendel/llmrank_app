import { Resend } from "resend";
import {
  type Database,
  digestPreferenceQueries,
  projectQueries,
  crawlQueries,
  scoreQueries,
} from "@llm-boost/db";
import {
  weeklyDigestHtml,
  type WeeklyDigestData,
} from "./email-templates/weekly-digest";
import {
  monthlyDigestHtml,
  type MonthlyDigestData,
} from "./email-templates/monthly-digest";
import { createLogger } from "../lib/logger";

interface DigestServiceOptions {
  appBaseUrl: string;
}

export function createDigestService(
  db: Database,
  resendApiKey: string,
  options: DigestServiceOptions,
) {
  const log = createLogger({ context: "digest-service" });
  const resend = new Resend(resendApiKey);
  const digestQ = digestPreferenceQueries(db);
  const projectQ = projectQueries(db);
  const crawlQ = crawlQueries(db);
  const scoreQ = scoreQueries(db);
  const baseUrl = options.appBaseUrl.replace(/\/$/, "");

  return {
    async processWeeklyDigests(): Promise<number> {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 6); // at least 6 days since last digest

      const users = await digestQ.getUsersDueForDigest("weekly", cutoff);
      let sent = 0;

      for (const user of users) {
        try {
          const projects = await projectQ.listByUser(user.id);
          if (projects.length === 0) continue;

          // Send one digest per project for weekly
          for (const project of projects) {
            const data = await buildWeeklyData(user, project);
            if (!data) continue;

            await resend.emails.send({
              from: "LLM Rank <digest@llmboost.io>",
              to: [user.email],
              subject: `Weekly Digest: ${project.name}`,
              html: weeklyDigestHtml(data),
            });
          }

          await digestQ.markDigestSent(user.id);
          sent++;
        } catch (err) {
          log.error("Failed to send weekly digest", {
            userId: user.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      log.info("Weekly digest processing complete", {
        sent,
        total: users.length,
      });
      return sent;
    },

    async processMonthlyDigests(): Promise<number> {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 27); // at least 27 days since last digest

      const users = await digestQ.getUsersDueForDigest("monthly", cutoff);
      let sent = 0;

      for (const user of users) {
        try {
          const projects = await projectQ.listByUser(user.id);
          if (projects.length === 0) continue;

          const data = await buildMonthlyData(user, projects);

          await resend.emails.send({
            from: "LLM Rank <digest@llmboost.io>",
            to: [user.email],
            subject: "Monthly AI-Readiness Report",
            html: monthlyDigestHtml(data),
          });

          await digestQ.markDigestSent(user.id);
          sent++;
        } catch (err) {
          log.error("Failed to send monthly digest", {
            userId: user.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      log.info("Monthly digest processing complete", {
        sent,
        total: users.length,
      });
      return sent;
    },
  };

  async function buildWeeklyData(
    user: { id: string; email: string },
    project: { id: string; name: string; domain: string },
  ): Promise<WeeklyDigestData | null> {
    const crawls = await crawlQ.listByProject(project.id);
    const completed = crawls
      .filter((c) => c.status === "complete" && c.summaryData)
      .slice(0, 2);

    if (completed.length === 0) return null;

    const latest = completed[0];
    const previous = completed.length > 1 ? completed[1] : null;
    const sd = latest.summaryData as Record<string, unknown>;

    const currentScore =
      typeof sd.overallScore === "number" ? sd.overallScore : 0;
    const previousScore =
      previous &&
      typeof (previous.summaryData as any)?.overallScore === "number"
        ? (previous.summaryData as any).overallScore
        : null;
    const letterGrade =
      typeof sd.letterGrade === "string" ? sd.letterGrade : "F";

    // Count issues for latest crawl
    const allIssues = await scoreQ.getIssuesByJob(latest.id);
    const previousIssues = previous
      ? await scoreQ.getIssuesByJob(previous.id)
      : [];

    const previousIssueKeys = new Set(
      previousIssues.map((i: any) => `${i.code}:${i.pageId}`),
    );
    const currentIssueKeys = new Set(
      allIssues.map((i: any) => `${i.code}:${i.pageId}`),
    );

    const newIssueCount = allIssues.filter(
      (i: any) => !previousIssueKeys.has(`${i.code}:${i.pageId}`),
    ).length;
    const resolvedIssueCount = previousIssues.filter(
      (i: any) => !currentIssueKeys.has(`${i.code}:${i.pageId}`),
    ).length;

    // Quick wins: issues with high score impact
    const topQuickWins = allIssues
      .filter((i: any) => i.severity === "critical" || i.severity === "high")
      .slice(0, 3)
      .map((i: any) => ({
        title: i.message ?? i.code,
        impact: i.scoreImpact ?? 5,
      }));

    return {
      userName: user.email.split("@")[0],
      projectName: project.name,
      domain: project.domain,
      currentScore,
      previousScore,
      scoreDelta: previousScore !== null ? currentScore - previousScore : 0,
      letterGrade,
      newIssueCount,
      resolvedIssueCount,
      topQuickWins,
      dashboardUrl: `${baseUrl}/dashboard/projects/${project.id}`,
    };
  }

  async function buildMonthlyData(
    user: { id: string; email: string },
    projects: Array<{ id: string; name: string; domain: string }>,
  ): Promise<MonthlyDigestData> {
    const projectData = await Promise.all(
      projects.map(async (project) => {
        const crawls = await crawlQ.listByProject(project.id);
        const completed = crawls
          .filter((c) => c.status === "complete" && c.summaryData)
          .slice(0, 2);

        if (completed.length === 0) {
          return {
            name: project.name,
            domain: project.domain,
            currentScore: 0,
            previousScore: null,
            scoreDelta: 0,
            letterGrade: "N/A",
            issueCount: 0,
          };
        }

        const latest = completed[0];
        const previous = completed.length > 1 ? completed[1] : null;
        const sd = latest.summaryData as Record<string, unknown>;

        const currentScore =
          typeof sd.overallScore === "number" ? sd.overallScore : 0;
        const previousScore =
          previous &&
          typeof (previous.summaryData as any)?.overallScore === "number"
            ? (previous.summaryData as any).overallScore
            : null;

        const issueCount = (await scoreQ.getIssuesByJob(latest.id)).length;

        return {
          name: project.name,
          domain: project.domain,
          currentScore,
          previousScore,
          scoreDelta: previousScore !== null ? currentScore - previousScore : 0,
          letterGrade:
            typeof sd.letterGrade === "string" ? sd.letterGrade : "F",
          issueCount,
        };
      }),
    );

    return {
      userName: user.email.split("@")[0],
      projects: projectData,
      settingsUrl: `${baseUrl}/dashboard/settings`,
      dashboardUrl: `${baseUrl}/dashboard`,
    };
  }
}
