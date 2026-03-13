import { Hono } from "hono";
import type { AppEnv } from "../index";
import { eq, desc, and } from "drizzle-orm";
import { promptTemplates, promptMetrics } from "@llm-boost/db";
import Anthropic from "@anthropic-ai/sdk";

export const adminPromptRoutes = new Hono<AppEnv>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function computeContentHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => variables[key] ?? `{{${key}}}`,
  );
}

// ─── GET / — List all prompts (latest version per slug) ──────────────────────

adminPromptRoutes.get("/", async (c) => {
  const db = c.get("db");

  const allPrompts = await db
    .select()
    .from(promptTemplates)
    .orderBy(desc(promptTemplates.version));

  // Group by slug, keep latest version for each
  const latestBySlug = new Map<string, (typeof allPrompts)[number]>();
  for (const p of allPrompts) {
    if (!latestBySlug.has(p.slug)) {
      latestBySlug.set(p.slug, p);
    }
  }

  // Group by category
  const grouped: Record<string, (typeof allPrompts)[number][]> = {};
  for (const p of latestBySlug.values()) {
    if (!grouped[p.category]) {
      grouped[p.category] = [];
    }
    grouped[p.category].push(p);
  }

  return c.json({ data: grouped });
});

// ─── GET /:id — Get single prompt by ID with version history ─────────────────

adminPromptRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [prompt] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1);

  if (!prompt) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Prompt not found" } },
      404,
    );
  }

  // Fetch version history for this slug
  const history = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.slug, prompt.slug))
    .orderBy(desc(promptTemplates.version));

  return c.json({ data: { ...prompt, history } });
});

// ─── GET /history/:slug — Get all versions for a prompt slug ─────────────────

adminPromptRoutes.get("/history/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const versions = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.slug, slug))
    .orderBy(desc(promptTemplates.version));

  return c.json({ data: versions });
});

// ─── POST /:slug/versions — Create new version of a prompt ───────────────────

adminPromptRoutes.post("/:slug/versions", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const userId = c.get("userId");

  const body = await c.req.json<{
    name: string;
    category: string;
    description?: string;
    systemPrompt: string;
    userPromptTemplate: string;
    variables?: string[];
    model: string;
    modelConfig?: { maxTokens?: number; temperature?: number };
  }>();

  if (
    !body.name ||
    !body.systemPrompt ||
    !body.userPromptTemplate ||
    !body.model ||
    !body.category
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "name, category, systemPrompt, userPromptTemplate, and model are required",
        },
      },
      422,
    );
  }

  // Get current latest version for this slug
  const [current] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.slug, slug))
    .orderBy(desc(promptTemplates.version))
    .limit(1);

  const nextVersion = current ? current.version + 1 : 1;
  const contentHash = await computeContentHash(
    body.systemPrompt + body.userPromptTemplate,
  );

  const [created] = await db
    .insert(promptTemplates)
    .values({
      name: body.name,
      slug,
      category: body.category,
      description: body.description ?? null,
      systemPrompt: body.systemPrompt,
      userPromptTemplate: body.userPromptTemplate,
      variables: body.variables ?? null,
      model: body.model,
      modelConfig: body.modelConfig ?? null,
      version: nextVersion,
      contentHash,
      status: "draft",
      parentId: current?.id ?? null,
      createdBy: userId,
    })
    .returning();

  return c.json({ data: created }, 201);
});

// ─── POST /:id/activate — Activate a prompt version ──────────────────────────

adminPromptRoutes.post("/:id/activate", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [prompt] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1);

  if (!prompt) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Prompt not found" } },
      404,
    );
  }

  // Archive the current active version for this slug
  await db
    .update(promptTemplates)
    .set({ status: "archived" })
    .where(
      and(
        eq(promptTemplates.slug, prompt.slug),
        eq(promptTemplates.status, "active"),
      ),
    );

  // Activate this version
  const [activated] = await db
    .update(promptTemplates)
    .set({ status: "active", activatedAt: new Date() })
    .where(eq(promptTemplates.id, id))
    .returning();

  return c.json({ data: activated });
});

// ─── POST /:id/archive — Archive a prompt version ────────────────────────────

adminPromptRoutes.post("/:id/archive", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [prompt] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1);

  if (!prompt) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Prompt not found" } },
      404,
    );
  }

  const [archived] = await db
    .update(promptTemplates)
    .set({ status: "archived" })
    .where(eq(promptTemplates.id, id))
    .returning();

  return c.json({ data: archived });
});

// ─── POST /:id/test — Test a prompt with sample input ────────────────────────

adminPromptRoutes.post("/:id/test", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [prompt] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1);

  if (!prompt) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Prompt not found" } },
      404,
    );
  }

  const body = await c.req.json<{ variables: Record<string, string> }>();
  if (!body.variables || typeof body.variables !== "object") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "variables object is required",
        },
      },
      422,
    );
  }

  const interpolatedUserPrompt = interpolateTemplate(
    prompt.userPromptTemplate,
    body.variables,
  );

  try {
    const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
    const startTime = Date.now();

    const response = await client.messages.create({
      model: prompt.model,
      max_tokens: prompt.modelConfig?.maxTokens ?? 1024,
      system: prompt.systemPrompt,
      messages: [{ role: "user", content: interpolatedUserPrompt }],
      ...(prompt.modelConfig?.temperature != null
        ? { temperature: prompt.modelConfig.temperature }
        : {}),
    });

    const latencyMs = Date.now() - startTime;
    const outputText =
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n") ?? "";

    return c.json({
      data: {
        output: outputText,
        interpolatedPrompt: interpolatedUserPrompt,
        model: prompt.model,
        latencyMs,
        usage: response.usage,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: {
          code: "LLM_ERROR",
          message: error instanceof Error ? error.message : "LLM call failed",
        },
      },
      500,
    );
  }
});

// ─── GET /:id/metrics — Get metrics for a prompt ─────────────────────────────

adminPromptRoutes.get("/:id/metrics", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  // Verify prompt exists
  const [prompt] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id))
    .limit(1);

  if (!prompt) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Prompt not found" } },
      404,
    );
  }

  const metrics = await db
    .select()
    .from(promptMetrics)
    .where(eq(promptMetrics.promptId, id))
    .orderBy(desc(promptMetrics.periodStart));

  return c.json({ data: metrics });
});

// ─── GET /diff/:id1/:id2 — Return both prompts side by side for diffing ─────

adminPromptRoutes.get("/diff/:id1/:id2", async (c) => {
  const db = c.get("db");
  const id1 = c.req.param("id1");
  const id2 = c.req.param("id2");

  const [prompt1] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id1))
    .limit(1);

  const [prompt2] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id2))
    .limit(1);

  if (!prompt1 || !prompt2) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "One or both prompts not found",
        },
      },
      404,
    );
  }

  return c.json({
    data: {
      left: prompt1,
      right: prompt2,
    },
  });
});
