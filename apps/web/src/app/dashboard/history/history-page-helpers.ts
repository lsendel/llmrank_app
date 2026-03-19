import { BarChart3, FileText, Play, type LucideIcon } from "lucide-react";
import type { CrawlJob } from "@/lib/api";

export const HISTORY_PAGE_SIZE = 20;

export interface HistoryWorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
}

const HISTORY_WORKFLOW_STEPS: HistoryWorkflowStep[] = [
  {
    title: "Track score movement over time",
    description: "Compare recent crawl outcomes before planning changes.",
    icon: BarChart3,
    href: "/dashboard/projects",
  },
  {
    title: "Open detailed reports",
    description: "Jump directly into project reports for root-cause analysis.",
    icon: FileText,
    href: "/dashboard/projects",
  },
  {
    title: "Rerun the highest-risk projects",
    description: "Prioritize projects with recent failures or score drops.",
    icon: Play,
    href: "/dashboard/projects",
  },
];

export function getHistoryWorkflowContent(isFree: boolean) {
  if (isFree) {
    return {
      description:
        "Use crawl history to validate progress, spot regressions, and decide the next run.",
      actions: [{ label: "View Plans", href: "/dashboard/billing" }],
      steps: HISTORY_WORKFLOW_STEPS,
    };
  }

  return {
    description:
      "Review crawl outcomes, inspect reports, and trigger follow-up runs from one place.",
    actions: [
      {
        label: "Open Projects",
        href: "/dashboard/projects",
        variant: "outline" as const,
      },
      {
        label: "New Project",
        href: "/dashboard/projects/new",
        variant: "ghost" as const,
      },
    ],
    steps: [
      {
        ...HISTORY_WORKFLOW_STEPS[0],
        description:
          "Use status and score columns to spot wins and regressions quickly.",
      },
      {
        title: "Open detailed crawl reports",
        description:
          "Jump into complete runs to investigate issues and confirm improvements.",
        icon: FileText,
        href: "/dashboard/projects",
      },
      {
        title: "Queue follow-up runs",
        description:
          "Rerun priority projects when failures or low scores need verification.",
        icon: Play,
        href: "/dashboard/projects",
      },
    ],
  };
}

export function getHistoryStatusVariant(status: CrawlJob["status"]) {
  if (status === "complete") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

export function getHistoryScoreClassName(letterGrade: string | null) {
  if (letterGrade === "A") return "text-green-500";
  if (letterGrade === "B") return "text-blue-500";
  if (letterGrade === "C") return "text-yellow-500";
  return "text-red-500";
}
