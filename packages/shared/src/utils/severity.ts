/**
 * Rank an issue severity for sorting/prioritization. Higher = more severe.
 * Unknown/missing severities rank 0 so they sort last.
 *
 * Single source of truth — replaces the copies that previously lived in
 * insights-service, insight-capture-service, and quick-wins.
 */
export function severityRank(severity: string | null | undefined): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "info":
      return 1;
    default:
      return 0;
  }
}
