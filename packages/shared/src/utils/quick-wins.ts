import {
  ISSUE_DEFINITIONS,
  type IssueDefinition,
  type EffortLevel,
} from "../constants/issues";

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
}

interface IssueInstance {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string | null;
  data?: Record<string, unknown> | unknown;
}

const EFFORT_DIVISOR: Record<EffortLevel, number> = {
  low: 1,
  medium: 2,
  high: 4,
};

const SEVERITY_MULTIPLIER: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Ranks issues by impact and returns the top N quick wins.
 * Priority = |scoreImpact| × severityMultiplier / effortDivisor
 */
export function getQuickWins(issues: IssueInstance[], limit = 5): QuickWin[] {
  // Group issues by code and count affected pages
  const codeMap = new Map<string, { count: number; sample: IssueInstance }>();
  for (const issue of issues) {
    const existing = codeMap.get(issue.code);
    if (existing) {
      existing.count++;
    } else {
      codeMap.set(issue.code, { count: 1, sample: issue });
    }
  }

  const wins: QuickWin[] = [];

  for (const [code, { count, sample }] of codeMap) {
    const def: IssueDefinition | undefined = ISSUE_DEFINITIONS[code];
    if (!def) continue;

    const impact = Math.abs(def.scoreImpact);
    if (impact === 0) continue; // Skip LLM-scored dynamic issues

    const severity = SEVERITY_MULTIPLIER[def.severity] ?? 1;
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
    });
  }

  wins.sort((a, b) => b.priority - a.priority);
  return wins.slice(0, limit);
}
