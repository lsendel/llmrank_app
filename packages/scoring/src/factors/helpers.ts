import { ISSUE_DEFINITIONS, type Issue } from "@llm-boost/shared";

/** Mutable scoring state passed through factor functions. */
export interface ScoreState {
  score: number;
  issues: Issue[];
}

/** Apply a deduction to the score state and record the issue. */
export function deduct(
  state: ScoreState,
  code: string,
  amount: number,
  data?: Record<string, unknown>,
): void {
  const def = ISSUE_DEFINITIONS[code];
  if (!def) return;
  state.score = Math.max(0, state.score + amount); // amount is negative
  state.issues.push({
    code: def.code,
    category: def.category,
    severity: def.severity,
    message: def.message,
    recommendation: def.recommendation,
    data,
  });
}
