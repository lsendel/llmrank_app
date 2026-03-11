export function gradeColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-lime-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 60) return "text-orange-600";
  return "text-red-600";
}

export function gradeLabel(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function gradeBadgeColor(score: number): string {
  if (score >= 90) return "bg-green-100 text-green-700";
  if (score >= 80) return "bg-lime-100 text-lime-700";
  if (score >= 70) return "bg-yellow-100 text-yellow-700";
  if (score >= 60) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

export const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
  performance: "Performance",
};
