import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries, digestPreferenceQueries } from "@llm-boost/db";
import {
  UpdateProfileSchema,
  PersonaQuestionnaireSchema,
} from "@llm-boost/shared";
import { classifyPersona } from "../services/persona-classifier";

export const accountRoutes = new Hono<AppEnv>();
accountRoutes.use("*", authMiddleware);

const ACCOUNT_PREFERENCES_KEY_PREFIX = "account:preferences:";
const PROJECT_DEFAULT_PRESET_VALUES = [
  "seo_manager",
  "content_lead",
  "exec_summary",
] as const;
type ProjectDefaultPreset = (typeof PROJECT_DEFAULT_PRESET_VALUES)[number];
const PROJECT_TAB_VALUES = [
  "overview",
  "actions",
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
type ProjectTab = (typeof PROJECT_TAB_VALUES)[number];
const PROJECTS_HEALTH_FILTER_VALUES = [
  "all",
  "good",
  "needs_work",
  "poor",
  "no_crawl",
  "in_progress",
  "failed",
] as const;
type ProjectsHealthFilter = (typeof PROJECTS_HEALTH_FILTER_VALUES)[number];
const PROJECTS_SORT_VALUES = [
  "activity_desc",
  "score_desc",
  "score_asc",
  "name_asc",
  "name_desc",
  "created_desc",
  "created_asc",
] as const;
type ProjectsSort = (typeof PROJECTS_SORT_VALUES)[number];
const PROJECTS_ANOMALY_FILTER_VALUES = [
  "all",
  "failed",
  "stale",
  "no_crawl",
  "in_progress",
  "low_score",
  "manual_schedule",
  "pipeline_disabled",
] as const;
type ProjectsAnomalyFilter = (typeof PROJECTS_ANOMALY_FILTER_VALUES)[number];

type AccountLastProjectContext = {
  projectId: string;
  tab: ProjectTab;
  projectName: string | null;
  domain: string | null;
  visitedAt: string;
};
type AccountProjectsViewState = {
  health: ProjectsHealthFilter;
  sort: ProjectsSort;
  anomaly: ProjectsAnomalyFilter;
};

type AccountPreferences = {
  projectsDefaultPreset: ProjectDefaultPreset | null;
  lastProjectContext: AccountLastProjectContext | null;
  dashboardLastVisitedAt: string | null;
  projectsLastVisitedAt: string | null;
  projectsLastViewState: AccountProjectsViewState | null;
};

function accountPreferencesKey(userId: string) {
  return `${ACCOUNT_PREFERENCES_KEY_PREFIX}${userId}`;
}

function normalizeProjectDefaultPreset(
  value: unknown,
): ProjectDefaultPreset | null {
  if (typeof value !== "string") return null;
  if (
    (PROJECT_DEFAULT_PRESET_VALUES as readonly string[]).includes(
      value as string,
    )
  ) {
    return value as ProjectDefaultPreset;
  }
  return null;
}

function normalizeProjectTab(value: unknown): ProjectTab | null {
  if (typeof value !== "string") return null;
  if ((PROJECT_TAB_VALUES as readonly string[]).includes(value as string)) {
    return value as ProjectTab;
  }
  return null;
}

function normalizeLastProjectContext(
  value: unknown,
): AccountLastProjectContext | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.projectId !== "string" || raw.projectId.trim().length === 0) {
    return null;
  }
  const tab = normalizeProjectTab(raw.tab);
  if (!tab) return null;
  if (
    typeof raw.visitedAt !== "string" ||
    raw.visitedAt.length === 0 ||
    Number.isNaN(Date.parse(raw.visitedAt))
  ) {
    return null;
  }

  return {
    projectId: raw.projectId,
    tab,
    projectName: typeof raw.projectName === "string" ? raw.projectName : null,
    domain: typeof raw.domain === "string" ? raw.domain : null,
    visitedAt: raw.visitedAt,
  };
}

function normalizePreferenceTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value;
}

function normalizeProjectsHealthFilter(
  value: unknown,
): ProjectsHealthFilter | null {
  if (typeof value !== "string") return null;
  if (
    (PROJECTS_HEALTH_FILTER_VALUES as readonly string[]).includes(
      value as string,
    )
  ) {
    return value as ProjectsHealthFilter;
  }
  return null;
}

function normalizeProjectsSort(value: unknown): ProjectsSort | null {
  if (typeof value !== "string") return null;
  if ((PROJECTS_SORT_VALUES as readonly string[]).includes(value as string)) {
    return value as ProjectsSort;
  }
  return null;
}

function normalizeProjectsAnomalyFilter(
  value: unknown,
): ProjectsAnomalyFilter | null {
  if (typeof value !== "string") return null;
  if (
    (PROJECTS_ANOMALY_FILTER_VALUES as readonly string[]).includes(
      value as string,
    )
  ) {
    return value as ProjectsAnomalyFilter;
  }
  return null;
}

function normalizeProjectsViewState(
  value: unknown,
): AccountProjectsViewState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const health = normalizeProjectsHealthFilter(raw.health);
  const sort = normalizeProjectsSort(raw.sort);
  const anomaly = normalizeProjectsAnomalyFilter(raw.anomaly);
  if (!health || !sort || !anomaly) return null;
  return { health, sort, anomaly };
}

function parseAccountPreferences(raw: string | null): AccountPreferences {
  if (!raw) {
    return {
      projectsDefaultPreset: null,
      lastProjectContext: null,
      dashboardLastVisitedAt: null,
      projectsLastVisitedAt: null,
      projectsLastViewState: null,
    };
  }
  try {
    const parsed = JSON.parse(raw) as {
      projectsDefaultPreset?: unknown;
      lastProjectContext?: unknown;
      dashboardLastVisitedAt?: unknown;
      projectsLastVisitedAt?: unknown;
      projectsLastViewState?: unknown;
    };
    return {
      projectsDefaultPreset: normalizeProjectDefaultPreset(
        parsed.projectsDefaultPreset,
      ),
      lastProjectContext: normalizeLastProjectContext(
        parsed.lastProjectContext,
      ),
      dashboardLastVisitedAt: normalizePreferenceTimestamp(
        parsed.dashboardLastVisitedAt,
      ),
      projectsLastVisitedAt: normalizePreferenceTimestamp(
        parsed.projectsLastVisitedAt,
      ),
      projectsLastViewState: normalizeProjectsViewState(
        parsed.projectsLastViewState,
      ),
    };
  } catch {
    return {
      projectsDefaultPreset: null,
      lastProjectContext: null,
      dashboardLastVisitedAt: null,
      projectsLastVisitedAt: null,
      projectsLastViewState: null,
    };
  }
}

// ---------------------------------------------------------------------------
// GET / — Get current user info
// ---------------------------------------------------------------------------

accountRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }
  return c.json({ data: user });
});

// ---------------------------------------------------------------------------
// PUT / — Update profile (name, phone)
// ---------------------------------------------------------------------------

accountRoutes.put("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422,
    );
  }
  const updated = await userQueries(db).updateProfile(userId, parsed.data);
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// POST /classify-persona — Classify user persona from questionnaire
// ---------------------------------------------------------------------------

accountRoutes.post("/classify-persona", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }
  const parsed = PersonaQuestionnaireSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422,
    );
  }

  try {
    const result = classifyPersona(parsed.data);

    // Persist the classified persona to the user record
    await userQueries(db).updateProfile(userId, { persona: result.persona });

    return c.json({ data: result });
  } catch (error) {
    c.var.logger.error("[classify-persona] Failed for user", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to classify persona",
        },
      },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /notifications — Get notification preferences
// ---------------------------------------------------------------------------

accountRoutes.get("/notifications", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }
  return c.json({
    data: {
      notifyOnCrawlComplete: user.notifyOnCrawlComplete,
      notifyOnScoreDrop: user.notifyOnScoreDrop,
      webhookUrl: user.webhookUrl ?? null,
    },
  });
});

// ---------------------------------------------------------------------------
// PUT /notifications — Update notification preferences
// ---------------------------------------------------------------------------

accountRoutes.put("/notifications", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }

  const data: {
    notifyOnCrawlComplete?: boolean;
    notifyOnScoreDrop?: boolean;
    webhookUrl?: string | null;
  } = {};
  if (typeof body.notifyOnCrawlComplete === "boolean") {
    data.notifyOnCrawlComplete = body.notifyOnCrawlComplete;
  }
  if (typeof body.notifyOnScoreDrop === "boolean") {
    data.notifyOnScoreDrop = body.notifyOnScoreDrop;
  }
  if ("webhookUrl" in body) {
    if (body.webhookUrl === null || body.webhookUrl === "") {
      data.webhookUrl = null;
    } else if (
      typeof body.webhookUrl === "string" &&
      body.webhookUrl.startsWith("https://")
    ) {
      data.webhookUrl = body.webhookUrl;
    } else {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Webhook URL must be an HTTPS URL",
          },
        },
        422,
      );
    }
  }

  const updated = await userQueries(db).updateNotifications(userId, data);
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// GET /digest — Get digest preferences
// ---------------------------------------------------------------------------

accountRoutes.get("/digest", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const prefs = await digestPreferenceQueries(db).getPreferences(userId);
  if (!prefs) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }
  return c.json({ data: prefs });
});

// ---------------------------------------------------------------------------
// PUT /digest — Update digest preferences
// ---------------------------------------------------------------------------

const VALID_FREQUENCIES = ["off", "weekly", "monthly"] as const;

accountRoutes.put("/digest", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }

  const update: { digestFrequency?: string; digestDay?: number } = {};

  if ("digestFrequency" in body) {
    if (!VALID_FREQUENCIES.includes(body.digestFrequency)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `digestFrequency must be one of: ${VALID_FREQUENCIES.join(", ")}`,
          },
        },
        422,
      );
    }
    update.digestFrequency = body.digestFrequency;
  }

  if ("digestDay" in body) {
    const day = Number(body.digestDay);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "digestDay must be an integer 0-6 (0=Sunday, 6=Saturday)",
          },
        },
        422,
      );
    }
    update.digestDay = day;
  }

  const updated = await digestPreferenceQueries(db).updatePreferences(
    userId,
    update,
  );
  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// GET /preferences — Get account-level UI preferences
// ---------------------------------------------------------------------------

accountRoutes.get("/preferences", async (c) => {
  const userId = c.get("userId");
  const raw = await c.env.KV.get(accountPreferencesKey(userId));
  return c.json({ data: parseAccountPreferences(raw) });
});

// ---------------------------------------------------------------------------
// PUT /preferences — Update account-level UI preferences
// ---------------------------------------------------------------------------

accountRoutes.put("/preferences", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      422,
    );
  }

  const hasProjectsDefaultPreset = "projectsDefaultPreset" in body;
  const hasLastProjectContext = "lastProjectContext" in body;
  const hasDashboardLastVisitedAt = "dashboardLastVisitedAt" in body;
  const hasProjectsLastVisitedAt = "projectsLastVisitedAt" in body;
  const hasProjectsLastViewState = "projectsLastViewState" in body;
  if (
    !hasProjectsDefaultPreset &&
    !hasLastProjectContext &&
    !hasDashboardLastVisitedAt &&
    !hasProjectsLastVisitedAt &&
    !hasProjectsLastViewState
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "At least one preference field is required (projectsDefaultPreset, lastProjectContext, dashboardLastVisitedAt, projectsLastVisitedAt, or projectsLastViewState)",
        },
      },
      422,
    );
  }

  const current = parseAccountPreferences(
    await c.env.KV.get(accountPreferencesKey(userId)),
  );

  let nextPreset = current.projectsDefaultPreset;
  if (hasProjectsDefaultPreset) {
    nextPreset =
      body.projectsDefaultPreset === null
        ? null
        : normalizeProjectDefaultPreset(body.projectsDefaultPreset);

    if (body.projectsDefaultPreset !== null && !nextPreset) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `projectsDefaultPreset must be one of: ${PROJECT_DEFAULT_PRESET_VALUES.join(", ")}, or null`,
          },
        },
        422,
      );
    }
  }

  let nextLastProjectContext = current.lastProjectContext;
  if (hasLastProjectContext) {
    nextLastProjectContext =
      body.lastProjectContext === null
        ? null
        : normalizeLastProjectContext(body.lastProjectContext);

    if (body.lastProjectContext !== null && !nextLastProjectContext) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "lastProjectContext must include projectId, tab, and ISO visitedAt",
          },
        },
        422,
      );
    }
  }

  let nextDashboardLastVisitedAt = current.dashboardLastVisitedAt;
  if (hasDashboardLastVisitedAt) {
    nextDashboardLastVisitedAt =
      body.dashboardLastVisitedAt === null
        ? null
        : normalizePreferenceTimestamp(body.dashboardLastVisitedAt);
    if (body.dashboardLastVisitedAt !== null && !nextDashboardLastVisitedAt) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "dashboardLastVisitedAt must be an ISO timestamp or null",
          },
        },
        422,
      );
    }
  }

  let nextProjectsLastVisitedAt = current.projectsLastVisitedAt;
  if (hasProjectsLastVisitedAt) {
    nextProjectsLastVisitedAt =
      body.projectsLastVisitedAt === null
        ? null
        : normalizePreferenceTimestamp(body.projectsLastVisitedAt);
    if (body.projectsLastVisitedAt !== null && !nextProjectsLastVisitedAt) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectsLastVisitedAt must be an ISO timestamp or null",
          },
        },
        422,
      );
    }
  }

  let nextProjectsLastViewState = current.projectsLastViewState;
  if (hasProjectsLastViewState) {
    nextProjectsLastViewState =
      body.projectsLastViewState === null
        ? null
        : normalizeProjectsViewState(body.projectsLastViewState);
    if (body.projectsLastViewState !== null && !nextProjectsLastViewState) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "projectsLastViewState must include health, sort, and anomaly",
          },
        },
        422,
      );
    }
  }

  const next: AccountPreferences = {
    projectsDefaultPreset: nextPreset,
    lastProjectContext: nextLastProjectContext,
    dashboardLastVisitedAt: nextDashboardLastVisitedAt,
    projectsLastVisitedAt: nextProjectsLastVisitedAt,
    projectsLastViewState: nextProjectsLastViewState,
  };

  await c.env.KV.put(accountPreferencesKey(userId), JSON.stringify(next));
  return c.json({ data: next });
});
