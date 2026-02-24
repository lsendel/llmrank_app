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

export function normalizeProjectTab(tab: string | null): ProjectTab {
  if (!tab) return DEFAULT_PROJECT_TAB;

  const normalizedTab = tab as ProjectTab;
  return PROJECT_TABS.includes(normalizedTab)
    ? normalizedTab
    : DEFAULT_PROJECT_TAB;
}
