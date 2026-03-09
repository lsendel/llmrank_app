import { type ReportSchedule } from "@/lib/api";

export type ReportAudience = "executive" | "seo_lead" | "content_lead";

export const REPORT_AUDIENCE_PRESETS: Record<
  ReportAudience,
  {
    label: string;
    description: string;
    format: "pdf" | "docx";
    type: "summary" | "detailed";
  }
> = {
  executive: {
    label: "Executive Summary",
    description: "High-level outcomes for leadership updates.",
    format: "pdf",
    type: "summary",
  },
  seo_lead: {
    label: "SEO Lead",
    description: "Detailed technical and visibility context for SEO owners.",
    format: "pdf",
    type: "detailed",
  },
  content_lead: {
    label: "Content Lead",
    description: "Detailed findings optimized for editorial execution.",
    format: "docx",
    type: "detailed",
  },
};

export const REPORT_AUDIENCE_ORDER: ReportAudience[] = [
  "executive",
  "seo_lead",
  "content_lead",
];

export function parseRecipientEmails(rawInput: string): {
  valid: string[];
  invalid: string[];
} {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of rawInput.split(/[,\n;]+/g)) {
    const normalized = token.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    if (emailRe.test(normalized)) {
      valid.push(normalized);
    } else {
      invalid.push(normalized);
    }
  }

  return { valid, invalid };
}

export function inferAudienceFromSchedule(
  schedule: ReportSchedule,
): ReportAudience | null {
  const match = REPORT_AUDIENCE_ORDER.find((audience) => {
    const preset = REPORT_AUDIENCE_PRESETS[audience];
    return preset.format === schedule.format && preset.type === schedule.type;
  });

  return match ?? null;
}
