import {
  ISSUE_DEFINITIONS,
  type Issue,
  type IssueCode,
} from "@llm-boost/shared";

/** Mutable scoring state passed through factor functions. */
export interface ScoreState {
  score: number;
  issues: Issue[];
}

/**
 * Apply a deduction to the score state and record the issue.
 * Amount defaults to the definition's scoreImpact; pass an explicit
 * amount only for dynamic deductions (LLM-scored factors, tiered penalties).
 */
export function deduct(
  state: ScoreState,
  code: IssueCode,
  amountOrData?: number | Record<string, unknown>,
  data?: Record<string, unknown>,
): void {
  const def = ISSUE_DEFINITIONS[code];
  let amount: number;
  let issueData: Record<string, unknown> | undefined;

  if (typeof amountOrData === "number") {
    amount = amountOrData;
    issueData = data;
  } else {
    amount = def.scoreImpact;
    issueData = amountOrData;
  }

  state.score = Math.max(0, state.score + amount);
  state.issues.push({
    code: def.code,
    category: def.category,
    severity: def.severity,
    message: def.message,
    recommendation: def.recommendation,
    data: issueData,
  });
}
