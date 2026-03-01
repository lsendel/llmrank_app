export type ConfidenceBadge = {
  label: "High" | "Medium" | "Low";
  variant: "success" | "warning" | "destructive";
};

interface RecommendationConfidenceInput {
  severity?: string | null;
  scoreImpact?: number | null;
  affectedPages?: number | null;
  totalPages?: number | null;
}

export function relativeTimeLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";

  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "Just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d ago`;

  return new Date(value).toLocaleDateString();
}

export function confidenceFromPageSample(
  pagesSampled: number,
): ConfidenceBadge {
  if (pagesSampled >= 75) return { label: "High", variant: "success" };
  if (pagesSampled >= 25) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}

export function confidenceFromVisibilityCoverage(
  checks: number,
  providers: number,
  queries: number,
): ConfidenceBadge {
  if (checks >= 30 && providers >= 4 && queries >= 5) {
    return { label: "High", variant: "success" };
  }
  if (checks >= 12 && providers >= 3 && queries >= 3) {
    return { label: "Medium", variant: "warning" };
  }
  return { label: "Low", variant: "destructive" };
}

export function confidenceFromRecommendation(
  input: RecommendationConfidenceInput,
): ConfidenceBadge {
  const severity = (input.severity ?? "").toLowerCase();
  const scoreImpact = Math.max(0, input.scoreImpact ?? 0);
  const affectedPages = Math.max(0, input.affectedPages ?? 0);
  const totalPages = Math.max(0, input.totalPages ?? 0);
  const coverageRatio = totalPages > 0 ? affectedPages / totalPages : 0;

  let points = 0;

  if (severity === "critical") points += 2;
  else if (severity === "warning") points += 1;

  if (scoreImpact >= 12) points += 2;
  else if (scoreImpact >= 6) points += 1;

  if (affectedPages >= 8) points += 2;
  else if (affectedPages >= 3) points += 1;

  if (coverageRatio >= 0.3) points += 1;
  if (coverageRatio >= 0.6) points += 1;

  if (points >= 5) return { label: "High", variant: "success" };
  if (points >= 2) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}
