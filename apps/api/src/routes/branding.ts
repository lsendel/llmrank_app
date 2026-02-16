import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import { z } from "zod";

export const brandingRoutes = new Hono<AppEnv>();

brandingRoutes.use("*", authMiddleware);

const brandingSchema = z.object({
  companyName: z.string().max(128).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color (#RRGGBB)")
    .optional(),
  logoUrl: z.string().url().optional(),
});

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
] as const;

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

// ---------------------------------------------------------------------------
// PUT /:projectId/branding — Save branding config
// ---------------------------------------------------------------------------

brandingRoutes.put(
  "/:projectId/branding",
  withOwnership("project"),
  async (c) => {
    const userId = c.get("userId");
    const container = c.get("container");

    // Plan gating
    const user = await container.users.getById(userId);
    if (!user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        401,
      );
    }
    const brandingLevel =
      PLAN_LIMITS[user.plan as PlanTier]?.reportBranding ?? "none";
    if (brandingLevel === "none") {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Upgrade to Pro or Agency for report branding",
          },
        },
        403,
      );
    }

    const body = brandingSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid branding data",
            details: body.error.flatten(),
          },
        },
        422,
      );
    }

    const project = c.get("project");
    const existing = (project.branding as Record<string, unknown> | null) ?? {};
    const merged = { ...existing, ...body.data };

    const updated = await container.projects.update(project.id, {
      branding: merged,
    });

    return c.json({ data: updated });
  },
);

// ---------------------------------------------------------------------------
// POST /:projectId/branding/logo — Upload logo to R2
// ---------------------------------------------------------------------------

brandingRoutes.post(
  "/:projectId/branding/logo",
  withOwnership("project"),
  async (c) => {
    const userId = c.get("userId");
    const container = c.get("container");

    // Plan gating
    const user = await container.users.getById(userId);
    if (!user) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        401,
      );
    }
    const brandingLevel =
      PLAN_LIMITS[user.plan as PlanTier]?.reportBranding ?? "none";
    if (brandingLevel === "none") {
      return c.json(
        {
          error: {
            code: "PLAN_LIMIT_REACHED",
            message: "Upgrade to Pro or Agency for report branding",
          },
        },
        403,
      );
    }

    // Parse multipart form data via Hono's parseBody (returns File objects)
    const body = await c.req.parseBody();
    const file = body["logo"];

    if (!file || typeof file === "string") {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: 'Missing "logo" file in form data',
          },
        },
        422,
      );
    }

    // file is now typed as File
    const fileType = file.type;
    const fileSize = file.size;

    // Validate file type
    if (
      !ALLOWED_MIME_TYPES.includes(
        fileType as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid file type "${fileType}". Allowed: PNG, JPEG, SVG`,
          },
        },
        422,
      );
    }

    // Validate file size
    if (fileSize > MAX_LOGO_SIZE) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `File too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB`,
          },
        },
        422,
      );
    }

    const project = c.get("project");
    const ext = mimeToExt(fileType);
    const r2Key = `branding/${project.id}/logo.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: fileType },
    });

    // Construct a public URL (convention: R2 custom domain or /api/public/r2/ proxy)
    const logoUrl = `branding/${project.id}/logo.${ext}`;

    // Merge logo URL into project branding
    const existing = (project.branding as Record<string, unknown> | null) ?? {};
    const merged = { ...existing, logoUrl };

    const updated = await container.projects.update(project.id, {
      branding: merged,
    });

    return c.json({ data: { logoUrl, project: updated } }, 201);
  },
);
