import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";

/**
 * Checks whether an llms.txt content string has the key structural elements
 * defined by the llmstxt.org spec:
 *   - Title line: `# Site Name` (H1, not ## H2)
 *   - Description line: `> Brief description`
 *   - Section heading: `## Section`
 *   - At least one link: `[text](url)`
 *
 * Returns the count of missing elements (0–4).
 */
function countMissingElements(content: string): number {
  const lines = content.split("\n");
  let missing = 0;

  // Title: a line starting with `# ` but NOT `## ` (i.e. an H1)
  const hasTitle = lines.some(
    (line) => /^#\s+/.test(line.trim()) && !/^##/.test(line.trim()),
  );
  if (!hasTitle) missing++;

  // Description: a line starting with `>`
  const hasDescription = lines.some((line) => /^>\s*/.test(line.trim()));
  if (!hasDescription) missing++;

  // Section heading: a line starting with `##`
  const hasSection = lines.some((line) => /^##\s+/.test(line.trim()));
  if (!hasSection) missing++;

  // Link: markdown link syntax [text](url)
  const hasLink = /\[.+?\]\(.+?\)/.test(content);
  if (!hasLink) missing++;

  return missing;
}

export function scoreLlmsTxt(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_LLMS_TXT: -20 if siteContext.hasLlmsTxt is false
  if (page.siteContext && !page.siteContext.hasLlmsTxt) {
    deduct(s, "MISSING_LLMS_TXT");
    return { score: Math.max(0, s.score), issues: s.issues };
  }

  // Quality scoring: only when llms.txt exists and content is available
  if (page.siteContext?.hasLlmsTxt && page.siteContext.llmsTxtContent != null) {
    const missing = countMissingElements(page.siteContext.llmsTxtContent);

    if (missing >= 2) {
      // Poorly structured — missing 2+ key elements
      deduct(s, "LLMS_TXT_QUALITY");
    } else if (missing === 1) {
      // Minimal — missing exactly 1 element
      deduct(s, "LLMS_TXT_INCOMPLETE");
    }
    // missing === 0 → all elements present, no deduction
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
