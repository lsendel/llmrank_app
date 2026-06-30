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
 * True when a link points at a high-authority host (.gov / .edu / .org, plus
 * ccTLD government/academic like .gov.uk / .ac.uk / .edu.au). Parses the actual
 * hostname instead of substring-matching the whole URL — the old
 * `url.includes('.org')` matched paths/queries (e.g. `/blog.organic`,
 * `?ref=.organization`), badly misjudging citations. Returns false for relative
 * or malformed URLs.
 */
export function isAuthoritativeUrl(link: string): boolean {
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return false;
  }
  // filter(Boolean) drops the empty label from an FQDN trailing dot ("x.org.").
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  // Authoritative gTLDs.
  if (tld === "gov" || tld === "edu" || tld === "org" || tld === "mil") {
    return true;
  }
  // ccTLD government/academic second level: nih.gov.uk, ox.ac.uk, anu.edu.au.
  // Require a 3+ label host ending in a 2-letter ccTLD so we don't accept
  // commercial domains like gov.com / gov.io / edu.io.
  if (labels.length >= 3 && tld.length === 2) {
    const sld = labels[labels.length - 2];
    return sld === "gov" || sld === "edu" || sld === "ac";
  }
  return false;
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
  customRecommendation?: string,
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
    recommendation: customRecommendation ?? def.recommendation,
    data: issueData,
    // The real applied deduction (signed). Tiered/LLM-scored factors compute
    // this dynamically, so it's the only honest basis for predicted lift.
    scoreImpact: amount,
  });
}
