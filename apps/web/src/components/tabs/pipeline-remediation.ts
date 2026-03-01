export interface PipelineRemediationTarget {
  label: string;
  description: string;
  href: string;
}

const STEP_TARGETS: Record<
  string,
  Omit<PipelineRemediationTarget, "href"> & {
    tab: string;
    configure?: string;
  }
> = {
  site_description: {
    tab: "configure",
    configure: "site-context",
    label: "Site Context",
    description:
      "Update site context so the description step has cleaner data.",
  },
  personas: {
    tab: "personas",
    label: "Personas",
    description: "Review generated personas and refresh audience targets.",
  },
  keywords: {
    tab: "keywords",
    label: "Keywords",
    description: "Validate suggested keywords and resolve keyword-data issues.",
  },
  competitors: {
    tab: "competitors",
    label: "Competitors",
    description: "Review competitor discovery and fix invalid competitors.",
  },
  visibility_check: {
    tab: "visibility",
    label: "Visibility Workspace",
    description: "Check provider setup and retry the visibility checks.",
  },
  content_optimization: {
    tab: "pages",
    label: "Pages",
    description: "Inspect page-level optimization opportunities and blockers.",
  },
  action_report: {
    tab: "reports",
    label: "Reports",
    description: "Review report settings and regenerate a recent report.",
  },
  health_check: {
    tab: "automation",
    label: "Automation",
    description: "Run the health check again after fixing blockers.",
  },
};

function normalizeStep(step: string): string {
  return step
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getPipelineRemediationTarget(
  projectId: string,
  step: string,
): PipelineRemediationTarget {
  const normalized = normalizeStep(step);
  const target = STEP_TARGETS[normalized];
  if (!target) {
    return {
      label: "Logs",
      description: "Open logs to inspect the raw pipeline failure details.",
      href: `/dashboard/projects/${projectId}?tab=logs`,
    };
  }

  const params = new URLSearchParams();
  params.set("tab", target.tab);
  if (target.configure) params.set("configure", target.configure);

  return {
    label: target.label,
    description: target.description,
    href: `/dashboard/projects/${projectId}?${params.toString()}`,
  };
}
