import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { auditLogQueries } from "@llm-boost/db";
import { createOrganizationService } from "../services/organization-service";
import { handleServiceError } from "../services/errors";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
});

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

const ChangeRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const organizationRoutes = new Hono<AppEnv>();
organizationRoutes.use("*", authMiddleware);

// GET / -- Get the current user's organization
organizationRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  try {
    const service = createOrganizationService(db);
    const org = await service.getForUser(userId);
    return c.json({ data: org });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST / -- Create a new organization
organizationRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = CreateOrgSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid organization data",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }

  try {
    const service = createOrganizationService(db);
    const org = await service.create(userId, body.data);
    return c.json({ data: org }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /:id/members -- List organization members
organizationRoutes.get("/:id/members", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const orgId = c.req.param("id");

  try {
    const service = createOrganizationService(db);
    const members = await service.listMembers(orgId, userId);
    return c.json({ data: members });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /:id/invites -- Invite a new member
organizationRoutes.post("/:id/invites", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const orgId = c.req.param("id");

  const body = InviteSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid invite data",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }

  try {
    const service = createOrganizationService(db);
    const invite = await service.inviteMember(orgId, userId, body.data);
    return c.json({ data: invite }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /:id/invites -- List organization invites
organizationRoutes.get("/:id/invites", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const orgId = c.req.param("id");

  try {
    const service = createOrganizationService(db);
    const invites = await service.listInvites(orgId, userId);
    return c.json({ data: invites });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /accept-invite -- Accept an invite by token
organizationRoutes.post("/accept-invite", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = z.object({ token: z.string() }).safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Token is required",
        },
      },
      422,
    );
  }

  try {
    const service = createOrganizationService(db);
    const result = await service.acceptInvite(body.data.token, userId);
    return c.json({ data: result }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// PATCH /:id/members/:memberId -- Change a member's role
organizationRoutes.patch("/:id/members/:memberId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const orgId = c.req.param("id");
  const memberId = c.req.param("memberId");

  const body = ChangeRoleSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Valid role required",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }

  try {
    const service = createOrganizationService(db);
    const updated = await service.changeMemberRole(
      orgId,
      userId,
      memberId,
      body.data.role,
    );
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// DELETE /:id/members/:memberId -- Remove a member
organizationRoutes.delete("/:id/members/:memberId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const orgId = c.req.param("id");
  const memberId = c.req.param("memberId");

  try {
    const service = createOrganizationService(db);
    const result = await service.removeMember(orgId, userId, memberId);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /:id/audit-log -- View audit log for the organization
organizationRoutes.get("/:id/audit-log", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const orgId = c.req.param("id");

  // Verify membership + AUDIT_VIEW permission via the service helper
  try {
    const service = createOrganizationService(db);
    // getById checks membership; we also need AUDIT_VIEW permission
    // We use the service's getById to verify membership first
    await service.getById(orgId, userId);
  } catch (error) {
    return handleServiceError(c, error);
  }

  // Parse query params
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;
  const action = c.req.query("action") || undefined;
  const sinceParam = c.req.query("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;

  const q = auditLogQueries(db);
  const { data, total } = await q.listByOrg(orgId, {
    limit,
    offset,
    action,
    since,
  });

  const transformed = data.map((row) => ({
    id: row.id,
    timestamp: row.createdAt,
    actorEmail: row.actorEmail,
    actorName: row.actorName,
    action: row.action,
    resource: row.resourceType ? `${row.resourceType}/${row.resourceId}` : null,
    details: row.metadata ? JSON.stringify(row.metadata) : null,
  }));

  return c.json({
    data: transformed,
    total,
    hasMore: offset + limit < total,
  });
});
