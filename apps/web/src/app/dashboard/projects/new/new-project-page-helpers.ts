import { Mail, PlayCircle, Settings2 } from "lucide-react";
import { normalizeDomain } from "@llm-boost/shared";
import type {
  WorkflowGuidanceAction,
  WorkflowGuidanceStep,
} from "@/components/ui/workflow-guidance";

export type CrawlSchedule = "manual" | "daily" | "weekly" | "monthly";

export interface NewProjectFormErrors {
  name?: string;
  domain?: string;
  form?: string;
}

export const NEW_PROJECT_WORKFLOW_ACTIONS: WorkflowGuidanceAction[] = [
  {
    label: "Back to Projects",
    href: "/dashboard/projects",
    variant: "outline",
  },
  {
    label: "Account Settings",
    href: "/dashboard/settings",
    variant: "ghost",
  },
];

export const NEW_PROJECT_WORKFLOW_STEPS: WorkflowGuidanceStep[] = [
  {
    title: "Set crawl and automation defaults",
    description:
      "Choose recurring cadence and post-crawl pipeline behavior up front.",
    icon: Settings2,
  },
  {
    title: "Run the first crawl immediately",
    description:
      "Enable auto-start to generate baseline scores and recommendations faster.",
    icon: PlayCircle,
  },
  {
    title: "Enable weekly communication loops",
    description:
      "Use digest and visibility schedules to keep stakeholders aligned.",
    icon: Mail,
  },
];

export const NEW_PROJECT_SCHEDULE_OPTIONS: Array<{
  value: CrawlSchedule;
  label: string;
}> = [
  { value: "manual", label: "Manual" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly (recommended)" },
  { value: "monthly", label: "Monthly" },
];

export function validateNewProjectForm(input: {
  name: string;
  domain: string;
}): Pick<NewProjectFormErrors, "name" | "domain"> {
  const errors: Pick<NewProjectFormErrors, "name" | "domain"> = {};

  if (!input.name.trim() || input.name.length > 100) {
    errors.name = "Name is required and must be 100 characters or fewer.";
  }

  if (!input.domain.trim()) {
    errors.domain = "Domain is required.";
  } else if (!normalizeDomain(input.domain)) {
    errors.domain = "Please enter a valid domain (e.g. example.com).";
  }

  return errors;
}

export function getNewProjectSubmitLabel(
  submitting: boolean,
  autoStartCrawl: boolean,
): string {
  if (!submitting) {
    return "Create Project";
  }

  return autoStartCrawl ? "Creating & Starting Crawl..." : "Creating...";
}
