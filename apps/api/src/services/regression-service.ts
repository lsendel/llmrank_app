interface RegressionServiceDeps {
  crawls: {
    listByProject: (projectId: string) => Promise<any[]>;
  };
  notifications: {
    create: (data: {
      userId: string;
      type: string;
      title: string;
      body: string;
      data: any;
    }) => Promise<any>;
  };
  actionItems?: {
    create: (data: {
      projectId: string;
      issueCode: string;
      status?: "pending" | "in_progress" | "fixed" | "dismissed";
      severity: "critical" | "warning" | "info";
      category:
        | "technical"
        | "content"
        | "ai_readiness"
        | "performance"
        | "schema"
        | "llm_visibility";
      scoreImpact: number;
      title: string;
      description?: string;
      assigneeId?: string | null;
      dueAt?: Date | null;
    }) => Promise<any>;
    getOpenByProjectIssueCode: (
      projectId: string,
      issueCode: string,
    ) => Promise<any | undefined>;
  };
}

export interface Regression {
  category: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: "critical" | "warning" | "info";
}

type SummaryScores = {
  overallScore?: number | null;
  categoryScores?: {
    technical?: number | null;
    content?: number | null;
    aiReadiness?: number | null;
    performance?: number | null;
  } | null;
};

// `overallScore` is a flat field, but the four categories live under
// `categoryScores` (see summary.ts). The previous flat keys (`technicalScore`…)
// matched nothing, so category regressions never fired. Read the nested paths.
const SCORE_CATEGORIES: {
  label: string;
  pick: (s: SummaryScores) => number | null | undefined;
}[] = [
  { label: "Overall", pick: (s) => s.overallScore },
  { label: "Technical", pick: (s) => s.categoryScores?.technical },
  { label: "Content", pick: (s) => s.categoryScores?.content },
  { label: "AI Readiness", pick: (s) => s.categoryScores?.aiReadiness },
  { label: "Performance", pick: (s) => s.categoryScores?.performance },
];

// summaryData is a TEXT (JSON) column; listByProject returns it unparsed.
function readSummary(raw: unknown): SummaryScores | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SummaryScores;
    } catch {
      return null;
    }
  }
  return raw as SummaryScores;
}

const REGRESSION_THRESHOLD = -5;
const CRITICAL_DUE_DAYS = 2;

function classifySeverity(delta: number): Regression["severity"] {
  if (delta <= -15) return "critical";
  if (delta <= -10) return "warning";
  return "info";
}

function issueCategoryFromRegression(
  category: string,
): "technical" | "content" | "ai_readiness" | "performance" {
  if (category === "Content") return "content";
  if (category === "AI Readiness") return "ai_readiness";
  if (category === "Performance") return "performance";
  return "technical";
}

function issueCodeFromRegression(category: string): string {
  const slug = category.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `SCORE_REGRESSION_${slug}`;
}

function defaultDueDate(days: number): string {
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

function dueDateToTimestamp(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

export function createRegressionService(deps: RegressionServiceDeps) {
  return {
    async detectRegressions(args: {
      projectId: string;
    }): Promise<Regression[]> {
      const allCrawls = await deps.crawls.listByProject(args.projectId);

      // Filter to completed crawls that have summary data
      const completedCrawls = allCrawls.filter(
        (c) => c.status === "complete" && c.summaryData,
      );

      if (completedCrawls.length < 2) {
        return [];
      }

      // Take the two most recent (assumes listByProject returns newest first)
      const latest = completedCrawls[0];
      const previous = completedCrawls[1];

      const latestSummary = readSummary(latest.summaryData);
      const previousSummary = readSummary(previous.summaryData);
      if (!latestSummary || !previousSummary) {
        return [];
      }

      const regressions: Regression[] = [];

      for (const { label, pick } of SCORE_CATEGORIES) {
        const currentScore = pick(latestSummary);
        const previousScore = pick(previousSummary);

        if (
          typeof currentScore !== "number" ||
          typeof previousScore !== "number"
        ) {
          continue;
        }

        const delta = currentScore - previousScore;

        if (delta <= REGRESSION_THRESHOLD) {
          regressions.push({
            category: label,
            previousScore,
            currentScore,
            delta,
            severity: classifySeverity(delta),
          });
        }
      }

      return regressions;
    },

    async checkAndNotify(args: {
      projectId: string;
      userId: string;
    }): Promise<Regression[]> {
      const regressions = await this.detectRegressions({
        projectId: args.projectId,
      });

      if (regressions.length === 0) {
        return [];
      }

      const summaryLines = regressions.map(
        (r) =>
          `${r.category}: ${r.previousScore} -> ${r.currentScore} (${r.delta > 0 ? "+" : ""}${r.delta})`,
      );

      const hasCritical = regressions.some((r) => r.severity === "critical");
      const title = hasCritical
        ? "Critical score regression detected"
        : "Score regression detected";

      const body = `The following score regressions were detected:\n${summaryLines.join("\n")}`;

      await deps.notifications.create({
        userId: args.userId,
        type: "regression_alert",
        title,
        body,
        data: {
          projectId: args.projectId,
          regressions,
        },
      });

      const criticalRegressions = regressions.filter(
        (r) => r.severity === "critical",
      );
      const actionItems = deps.actionItems;
      if (actionItems && criticalRegressions.length > 0) {
        await Promise.all(
          criticalRegressions.map(async (regression) => {
            const issueCode = issueCodeFromRegression(regression.category);
            const existing = await actionItems.getOpenByProjectIssueCode(
              args.projectId,
              issueCode,
            );
            if (existing) return;

            const dueDate = defaultDueDate(CRITICAL_DUE_DAYS);
            await actionItems.create({
              projectId: args.projectId,
              issueCode,
              status: "pending",
              severity: "critical",
              category: issueCategoryFromRegression(regression.category),
              scoreImpact: Math.abs(regression.delta),
              title: `${regression.category} score regression`,
              description:
                `Detected score drop: ${regression.previousScore} -> ${regression.currentScore} (${regression.delta}). ` +
                `Due by ${dueDate}.`,
              assigneeId: args.userId,
              dueAt: dueDateToTimestamp(dueDate),
            });
          }),
        );
      }

      return regressions;
    },
  };
}
