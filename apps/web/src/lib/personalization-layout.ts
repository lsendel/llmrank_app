import type {
  ProjectTab,
  ProjectTabGroup,
} from "@/app/dashboard/projects/[id]/tab-state";

export type SupportedPersona =
  | "agency"
  | "freelancer"
  | "in_house"
  | "developer";

export type DashboardQuickToolId =
  | "strategy_personas"
  | "competitor_tracking"
  | "ai_visibility";

export type FirstSevenDaysStepId =
  | "crawl"
  | "issues"
  | "automation"
  | "visibility";

export interface PersonalizationContext {
  persona?: string | null;
  isAdmin?: boolean | null;
}

const DEFAULT_PROJECT_GROUP_ORDER: ProjectTabGroup[] = [
  "analyze",
  "grow-visibility",
  "automate-operate",
  "configure",
];

const PROJECT_GROUP_ORDER_BY_PERSONA: Record<
  SupportedPersona,
  ProjectTabGroup[]
> = {
  agency: ["grow-visibility", "analyze", "automate-operate", "configure"],
  freelancer: ["analyze", "grow-visibility", "automate-operate", "configure"],
  in_house: ["grow-visibility", "analyze", "automate-operate", "configure"],
  developer: ["analyze", "configure", "automate-operate", "grow-visibility"],
};

const PROJECT_TAB_PRIORITY_BY_PERSONA: Record<SupportedPersona, ProjectTab[]> =
  {
    agency: [
      "strategy",
      "visibility",
      "competitors",
      "keywords",
      "personas",
      "issues",
      "actions",
      "overview",
      "history",
      "automation",
      "reports",
      "integrations",
      "logs",
      "pages",
      "settings",
    ],
    freelancer: [
      "issues",
      "actions",
      "overview",
      "visibility",
      "history",
      "strategy",
      "keywords",
      "personas",
      "automation",
      "reports",
      "competitors",
      "integrations",
      "logs",
      "pages",
      "settings",
    ],
    in_house: [
      "visibility",
      "keywords",
      "personas",
      "strategy",
      "competitors",
      "issues",
      "overview",
      "actions",
      "automation",
      "reports",
      "history",
      "integrations",
      "pages",
      "logs",
      "settings",
    ],
    developer: [
      "issues",
      "pages",
      "history",
      "overview",
      "actions",
      "settings",
      "logs",
      "automation",
      "integrations",
      "reports",
      "visibility",
      "strategy",
      "competitors",
      "personas",
      "keywords",
    ],
  };

const DEFAULT_QUICK_TOOL_ORDER: DashboardQuickToolId[] = [
  "strategy_personas",
  "competitor_tracking",
  "ai_visibility",
];

const QUICK_TOOL_ORDER_BY_PERSONA: Record<
  SupportedPersona,
  DashboardQuickToolId[]
> = {
  agency: ["competitor_tracking", "ai_visibility", "strategy_personas"],
  freelancer: ["strategy_personas", "ai_visibility", "competitor_tracking"],
  in_house: ["ai_visibility", "strategy_personas", "competitor_tracking"],
  developer: ["ai_visibility", "competitor_tracking", "strategy_personas"],
};

const DEFAULT_FIRST_SEVEN_DAYS_ORDER: FirstSevenDaysStepId[] = [
  "crawl",
  "issues",
  "automation",
  "visibility",
];

const FIRST_SEVEN_DAYS_ORDER_BY_PERSONA: Record<
  SupportedPersona,
  FirstSevenDaysStepId[]
> = {
  agency: ["crawl", "visibility", "issues", "automation"],
  freelancer: ["crawl", "issues", "visibility", "automation"],
  in_house: ["crawl", "visibility", "automation", "issues"],
  developer: ["crawl", "issues", "automation", "visibility"],
};

const SUPPORTED_PERSONA_SET = new Set<SupportedPersona>([
  "agency",
  "freelancer",
  "in_house",
  "developer",
]);

function asSupportedPersona(value?: string | null): SupportedPersona | null {
  if (!value) return null;
  return SUPPORTED_PERSONA_SET.has(value as SupportedPersona)
    ? (value as SupportedPersona)
    : null;
}

function prioritizeOrderedIds<T extends string>(
  ids: readonly T[],
  priority: readonly T[],
): T[] {
  const index = new Map<T, number>();
  priority.forEach((id, rank) => {
    if (!index.has(id)) {
      index.set(id, rank);
    }
  });
  return [...ids].sort((a, b) => {
    const rankA = index.get(a);
    const rankB = index.get(b);
    if (rankA == null && rankB == null) return 0;
    if (rankA == null) return 1;
    if (rankB == null) return -1;
    return rankA - rankB;
  });
}

export function resolveProjectGroupOrder(
  context?: PersonalizationContext,
): ProjectTabGroup[] {
  const persona = asSupportedPersona(context?.persona);
  const base = persona
    ? PROJECT_GROUP_ORDER_BY_PERSONA[persona]
    : DEFAULT_PROJECT_GROUP_ORDER;

  let ordered = [...base];
  if (context?.isAdmin) {
    ordered = prioritizeOrderedIds(ordered, [
      "configure",
      "automate-operate",
      "analyze",
      "grow-visibility",
    ]);
  }
  return ordered;
}

export function resolveProjectTabOrder(
  tabs: readonly ProjectTab[],
  context?: PersonalizationContext,
): ProjectTab[] {
  const persona = asSupportedPersona(context?.persona);
  const basePriority = persona
    ? PROJECT_TAB_PRIORITY_BY_PERSONA[persona]
    : PROJECT_TAB_PRIORITY_BY_PERSONA.freelancer;

  let ordered = prioritizeOrderedIds(tabs, basePriority);

  if (context?.isAdmin) {
    ordered = prioritizeOrderedIds(ordered, [
      "settings",
      "automation",
      "integrations",
      "logs",
      ...basePriority,
    ]);
  }

  return ordered;
}

export function resolveDashboardQuickToolOrder(
  context?: PersonalizationContext,
): DashboardQuickToolId[] {
  const persona = asSupportedPersona(context?.persona);
  const base = persona
    ? QUICK_TOOL_ORDER_BY_PERSONA[persona]
    : DEFAULT_QUICK_TOOL_ORDER;

  if (context?.isAdmin) {
    return prioritizeOrderedIds(base, [
      "competitor_tracking",
      "ai_visibility",
      "strategy_personas",
    ]);
  }

  return [...base];
}

export function resolveFirstSevenDaysOrder(
  context?: PersonalizationContext,
): FirstSevenDaysStepId[] {
  const persona = asSupportedPersona(context?.persona);
  const base = persona
    ? FIRST_SEVEN_DAYS_ORDER_BY_PERSONA[persona]
    : DEFAULT_FIRST_SEVEN_DAYS_ORDER;

  if (context?.isAdmin) {
    return prioritizeOrderedIds(base, [
      "automation",
      "crawl",
      "issues",
      "visibility",
    ]);
  }

  return [...base];
}
