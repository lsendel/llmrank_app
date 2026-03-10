import type { ShareInfo } from "@/lib/api";

export type ShareLevel = "summary" | "issues" | "full";
export type ExpiryOption = "permanent" | "7" | "30" | "90";

export const SHARE_LEVELS: ShareLevel[] = ["summary", "issues", "full"];

export const LEVEL_DESCRIPTIONS: Record<
  ShareLevel,
  { label: string; description: string }
> = {
  summary: {
    label: "Summary Only",
    description:
      "Overall score, letter grade, and category breakdown. No page-level details.",
  },
  issues: {
    label: "Summary + Issues",
    description:
      "Everything in Summary, plus the list of issues found and quick wins.",
  },
  full: {
    label: "Full Report",
    description:
      "Complete report including all pages, detailed scores, and recommendations.",
  },
};

export const EXPIRY_OPTIONS: Array<{ value: ExpiryOption; label: string }> = [
  { value: "permanent", label: "Permanent (never expires)" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export function expiryOptionToDate(option: ExpiryOption): string | null {
  if (option === "permanent") return null;
  const days = parseInt(option, 10);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function expiryToLabel(expiresAt: string | null): string {
  if (!expiresAt) return "Permanent";
  const date = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft <= 0) return "Expired";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
}

export function buildShareAssets(
  shareInfo: ShareInfo | null,
  {
    origin = "",
    apiBaseUrl = "",
  }: {
    origin?: string;
    apiBaseUrl?: string;
  } = {},
) {
  if (!shareInfo) {
    return {
      badgeUrl: "",
      htmlBadgeEmbed: "",
      markdownBadgeEmbed: "",
      shareUrl: "",
    };
  }

  const shareUrl = `${origin}/share/${shareInfo.shareToken}`;
  const badgeUrl = `${apiBaseUrl}/api/public/badge/${shareInfo.shareToken}.svg`;

  return {
    shareUrl,
    badgeUrl,
    htmlBadgeEmbed: `<a href="${shareUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeUrl}" alt="AI Readiness Score" /></a>`,
    markdownBadgeEmbed: `[![AI Readiness Score](${badgeUrl})](${shareUrl})`,
  };
}
