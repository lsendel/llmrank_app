import type { DigestPreferences } from "@/lib/api";

export type NotificationKey = "notifyOnCrawlComplete" | "notifyOnScoreDrop";

export type ProjectOption = {
  id: string;
  name: string;
};

export const PERSONA_OPTIONS = [
  { value: "agency", label: "Agency" },
  { value: "freelancer", label: "Freelancer" },
  { value: "in_house", label: "In-House" },
  { value: "developer", label: "Developer" },
] as const;

export const NOTIFICATION_OPTIONS: {
  key: NotificationKey;
  label: string;
  description: string;
}[] = [
  {
    key: "notifyOnCrawlComplete",
    label: "Crawl Complete",
    description: "Get notified when a crawl finishes.",
  },
  {
    key: "notifyOnScoreDrop",
    label: "Score Drops",
    description: "Get alerted when a project score drops by 10+ points.",
  },
];

export const DIGEST_FREQUENCY_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

export const DIGEST_DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
] as const;

export function formatPlanName(plan?: string | null) {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function validateWebhookUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return "URL must use HTTPS";
    }
  } catch {
    return "Invalid URL format";
  }

  return null;
}

export function showDigestDaySelect(digestPrefs?: DigestPreferences | null) {
  return digestPrefs?.digestFrequency === "weekly";
}

export function getClearHistoryLabel(
  clearTarget: string,
  projectsList: ProjectOption[],
) {
  if (clearTarget === "all") return "all projects";
  return (
    projectsList.find((project) => project.id === clearTarget)?.name ??
    "project"
  );
}
