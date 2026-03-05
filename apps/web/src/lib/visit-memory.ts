export function normalizeVisitTimestamp(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function timestampValue(value: string | null | undefined): number {
  const normalized = normalizeVisitTimestamp(value);
  if (!normalized) return 0;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function pickMostRecentVisitTimestamp(
  timestamps: Array<string | null | undefined>,
): string | null {
  return timestamps.reduce<string | null>((latest, current) => {
    const currentNormalized = normalizeVisitTimestamp(current);
    if (!currentNormalized) return latest;
    if (!latest) return currentNormalized;
    return timestampValue(currentNormalized) >= timestampValue(latest)
      ? currentNormalized
      : latest;
  }, null);
}
