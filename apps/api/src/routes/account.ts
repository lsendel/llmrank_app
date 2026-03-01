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

type AccountPreferences = {
  projectsDefaultPreset: ProjectDefaultPreset | null;
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

function parseAccountPreferences(raw: string | null): AccountPreferences {
  if (!raw) return { projectsDefaultPreset: null };
  try {
    const parsed = JSON.parse(raw) as { projectsDefaultPreset?: unknown };
    return {
      projectsDefaultPreset: normalizeProjectDefaultPreset(
        parsed.projectsDefaultPreset,
      ),
    };
  } catch {
    return { projectsDefaultPreset: null };
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
    console.error(`[classify-persona] Failed for user ${userId}:`, error);
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

  if (!("projectsDefaultPreset" in body)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectsDefaultPreset is required",
        },
      },
      422,
    );
  }

  const nextPreset =
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

  const next: AccountPreferences = {
    projectsDefaultPreset: nextPreset,
  };

  await c.env.KV.put(accountPreferencesKey(userId), JSON.stringify(next));
  return c.json({ data: next });
});
