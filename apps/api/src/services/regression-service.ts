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
}

export interface Regression {
  category: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: "critical" | "warning" | "info";
}

const SCORE_CATEGORIES = [
  { key: "overallScore", label: "Overall" },
  { key: "technicalScore", label: "Technical" },
  { key: "contentScore", label: "Content" },
  { key: "aiReadinessScore", label: "AI Readiness" },
  { key: "performanceScore", label: "Performance" },
] as const;

const REGRESSION_THRESHOLD = -5;

function classifySeverity(delta: number): Regression["severity"] {
  if (delta <= -15) return "critical";
  if (delta <= -10) return "warning";
  return "info";
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

      const latestSummary = latest.summaryData;
      const previousSummary = previous.summaryData;

      const regressions: Regression[] = [];

      for (const { key, label } of SCORE_CATEGORIES) {
        const currentScore = latestSummary[key];
        const previousScore = previousSummary[key];

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

      return regressions;
    },
  };
}
