import {
  ISSUE_DEFINITIONS,
  type IssueDefinition,
  type EffortLevel,
} from "../constants/issues";
import { severityRank } from "./severity";

export interface QuickWin {
  code: string;
  category: string;
  severity: string;
  scoreImpact: number;
  effortLevel: EffortLevel;
  message: string;
  recommendation: string;
  implementationSnippet?: string;
  priority: number;
  affectedPages: number;
  samplePageUrls?: string[];
}

interface IssueInstance {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string | null;
  data?: Record<string, unknown> | unknown;
  pageUrl?: string | null;
}

const EFFORT_DIVISOR: Record<EffortLevel, number> = {
  low: 1,
  medium: 2,
  high: 4,
};

/**
 * Ranks issues by impact and returns the top N quick wins.
 * Priority = |scoreImpact| × severityMultiplier / effortDivisor
 */
export function getQuickWins(issues: IssueInstance[], limit = 5): QuickWin[] {
  // Group issues by code and count affected pages
  const MAX_SAMPLE_URLS = 3;
  const codeMap = new Map<
    string,
    { count: number; sample: IssueInstance; urls: string[] }
  >();
  for (const issue of issues) {
    const existing = codeMap.get(issue.code);
    if (existing) {
      existing.count++;
      if (
        issue.pageUrl &&
        existing.urls.length < MAX_SAMPLE_URLS &&
        !existing.urls.includes(issue.pageUrl)
      ) {
        existing.urls.push(issue.pageUrl);
      }
    } else {
      codeMap.set(issue.code, {
        count: 1,
        sample: issue,
        urls: issue.pageUrl ? [issue.pageUrl] : [],
      });
    }
  }

  const wins: QuickWin[] = [];

  for (const [code, { count, sample, urls }] of codeMap) {
    const def: IssueDefinition | undefined = ISSUE_DEFINITIONS[code];
    if (!def) continue;

    const impact = Math.abs(def.scoreImpact);
    if (impact === 0) continue; // Skip LLM-scored dynamic issues

    const severity = severityRank(def.severity) || 1;
    const effort = EFFORT_DIVISOR[def.effortLevel] ?? 2;
    const priority = (impact * severity) / effort;

    wins.push({
      code,
      category: def.category,
      severity: def.severity,
      scoreImpact: def.scoreImpact,
      effortLevel: def.effortLevel,
      message: sample.message,
      recommendation: def.recommendation,
      implementationSnippet: def.implementationSnippet,
      priority,
      affectedPages: count,
      samplePageUrls: urls,
    });
  }

  wins.sort((a, b) => b.priority - a.priority);
  return wins.slice(0, limit);
}
