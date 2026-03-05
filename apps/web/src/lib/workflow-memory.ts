import type { ProjectTab } from "@/app/dashboard/projects/[id]/tab-state";

const LAST_PROJECT_CONTEXT_KEY = "llmrank:workflow:last-project-context";

export interface LastProjectContext {
  projectId: string;
  tab: ProjectTab;
  projectName: string | null;
  domain: string | null;
  visitedAt: string;
}

const PROJECT_TAB_LABELS: Record<ProjectTab, string> = {
  overview: "Overview",
  actions: "Actions",
  pages: "Pages",
  issues: "Issues",
  history: "History",
  strategy: "Strategy",
  competitors: "Competitors",
  "ai-visibility": "AI Visibility",
  "ai-analysis": "AI Analysis",
  visibility: "Visibility",
  personas: "Personas",
  keywords: "Keywords",
  integrations: "Integrations",
  reports: "Reports",
  automation: "Automation",
  logs: "Logs",
  settings: "Settings",
};

function contextTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function normalizeLastProjectContext(
  value: unknown,
): LastProjectContext | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<LastProjectContext>;
  if (typeof parsed.projectId !== "string" || parsed.projectId.length === 0) {
    return null;
  }
  if (typeof parsed.tab !== "string" || !(parsed.tab in PROJECT_TAB_LABELS)) {
    return null;
  }
  if (typeof parsed.visitedAt !== "string" || parsed.visitedAt.length === 0) {
    return null;
  }
  return {
    projectId: parsed.projectId,
    tab: parsed.tab as ProjectTab,
    projectName:
      typeof parsed.projectName === "string" ? parsed.projectName : null,
    domain: typeof parsed.domain === "string" ? parsed.domain : null,
    visitedAt: parsed.visitedAt,
  };
}

function parseContext(raw: string | null): LastProjectContext | null {
  if (!raw) return null;
  try {
    return normalizeLastProjectContext(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function pickMostRecentProjectContext(
  contexts: Array<LastProjectContext | null | undefined>,
): LastProjectContext | null {
  return contexts.reduce<LastProjectContext | null>((latest, current) => {
    if (!current) return latest;
    if (!latest) return current;
    return contextTimestamp(current.visitedAt) >=
      contextTimestamp(latest.visitedAt)
      ? current
      : latest;
  }, null);
}

export function getLastProjectContext(): LastProjectContext | null {
  if (typeof window === "undefined") return null;
  return parseContext(window.localStorage.getItem(LAST_PROJECT_CONTEXT_KEY));
}

export function saveLastProjectContext(input: {
  projectId: string;
  tab: ProjectTab;
  projectName?: string | null;
  domain?: string | null;
  visitedAt?: string | null;
}) {
  if (typeof window === "undefined") return;
  const next: LastProjectContext = {
    projectId: input.projectId,
    tab: input.tab,
    projectName: input.projectName ?? null,
    domain: input.domain ?? null,
    visitedAt:
      typeof input.visitedAt === "string" && input.visitedAt.length > 0
        ? input.visitedAt
        : new Date().toISOString(),
  };
  window.localStorage.setItem(LAST_PROJECT_CONTEXT_KEY, JSON.stringify(next));
}

export function clearLastProjectContext() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_PROJECT_CONTEXT_KEY);
}

export function lastProjectContextHref(context: LastProjectContext): string {
  return `/dashboard/projects/${context.projectId}?tab=${context.tab}`;
}

export function projectTabLabel(tab: ProjectTab): string {
  return PROJECT_TAB_LABELS[tab];
}
