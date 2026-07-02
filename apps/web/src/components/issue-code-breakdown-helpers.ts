import type { IssueCodeCount } from "@/lib/api";

export interface IssueCodeDeltaRow {
  code: string;
  category: string;
  severity: string;
  previous: number;
  current: number;
  delta: number;
}

/**
 * Diff two crawls' issue-code counts. Codes present in only one crawl are
 * kept (missing side counts as 0). Sorted by |delta| desc, then current
 * count desc — the codes that moved most float to the top.
 */
export function computeIssueCodeDeltas(
  previous: IssueCodeCount[],
  current: IssueCodeCount[],
): IssueCodeDeltaRow[] {
  const byCode = new Map<string, IssueCodeDeltaRow>();

  for (const row of previous) {
    const existing = byCode.get(row.code);
    if (existing) {
      existing.previous += row.count;
    } else {
      byCode.set(row.code, {
        code: row.code,
        category: row.category,
        severity: row.severity,
        previous: row.count,
        current: 0,
        delta: 0,
      });
    }
  }

  for (const row of current) {
    const existing = byCode.get(row.code);
    if (existing) {
      existing.current += row.count;
      // Prefer the current crawl's classification if it changed
      existing.category = row.category;
      existing.severity = row.severity;
    } else {
      byCode.set(row.code, {
        code: row.code,
        category: row.category,
        severity: row.severity,
        previous: 0,
        current: row.count,
        delta: 0,
      });
    }
  }

  const rows = Array.from(byCode.values());
  for (const row of rows) row.delta = row.current - row.previous;

  return rows.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current,
  );
}
