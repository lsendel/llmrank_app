export const PROJECT_TABS = [
  "overview",
  "pages",
  "issues",
  "history",
  "strategy",
  "competitors",
  "ai-visibility",
  "ai-analysis",
  "visibility",
  "personas",
  "keywords",
  "integrations",
  "reports",
  "automation",
  "logs",
  "settings",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

export const DEFAULT_PROJECT_TAB: ProjectTab = "overview";

export const PROJECT_TAB_GROUPS = [
  "analyze",
  "grow-visibility",
  "automate-operate",
  "configure",
] as const;

export type ProjectTabGroup = (typeof PROJECT_TAB_GROUPS)[number];

export const GROUP_DEFAULT_TABS: Record<ProjectTabGroup, ProjectTab> = {
  analyze: "overview",
  "grow-visibility": "visibility",
  "automate-operate": "automation",
  configure: "settings",
};

export function normalizeProjectTab(tab: string | null): ProjectTab {
  if (!tab) return DEFAULT_PROJECT_TAB;

  const normalizedTab = tab as ProjectTab;
  return PROJECT_TABS.includes(normalizedTab)
    ? normalizedTab
    : DEFAULT_PROJECT_TAB;
}

export function projectTabGroup(tab: ProjectTab): ProjectTabGroup {
  if (
    tab === "overview" ||
    tab === "pages" ||
    tab === "issues" ||
    tab === "history"
  ) {
    return "analyze";
  }

  if (
    tab === "strategy" ||
    tab === "competitors" ||
    tab === "ai-visibility" ||
    tab === "ai-analysis" ||
    tab === "visibility" ||
    tab === "personas" ||
    tab === "keywords"
  ) {
    return "grow-visibility";
  }

  if (
    tab === "integrations" ||
    tab === "reports" ||
    tab === "automation" ||
    tab === "logs"
  ) {
    return "automate-operate";
  }

  return "configure";
}
