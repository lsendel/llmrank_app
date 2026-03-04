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

function parseContext(raw: string | null): LastProjectContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastProjectContext>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.projectId !== "string" || parsed.projectId.length === 0) {
      return null;
    }
    if (typeof parsed.tab !== "string") return null;
    if (!(parsed.tab in PROJECT_TAB_LABELS)) return null;
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
  } catch {
    return null;
  }
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
}) {
  if (typeof window === "undefined") return;
  const next: LastProjectContext = {
    projectId: input.projectId,
    tab: input.tab,
    projectName: input.projectName ?? null,
    domain: input.domain ?? null,
    visitedAt: new Date().toISOString(),
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
