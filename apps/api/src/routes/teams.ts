import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { teamQueries } from "@llm-boost/db";
import { z } from "zod";

export const teamRoutes = new Hono<AppEnv>();
teamRoutes.use("*", authMiddleware);

// POST / — Create team
teamRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = z
    .object({ name: z.string().min(1).max(128) })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Name is required" } },
      422,
    );
  }
  const team = await teamQueries(db).create({
    name: body.data.name,
    ownerId: userId,
  });
  return c.json({ data: team }, 201);
});

// GET / — List user's teams
teamRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const teams = await teamQueries(db).listByUser(userId);
  return c.json({
    data: teams.map((t) => ({
      ...t.team,
      role: t.membership.role,
    })),
  });
});

// GET /:teamId — Team detail with members
teamRoutes.get("/:teamId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const teamId = c.req.param("teamId");

  const membership = await teamQueries(db).getMembership(teamId, userId);
  if (!membership) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Team not found" } },
      404,
    );
  }

  const [team, members] = await Promise.all([
    teamQueries(db).getById(teamId),
    teamQueries(db).listMembers(teamId),
  ]);

  return c.json({ data: { ...team, members, role: membership.role } });
});

// POST /:teamId/invite — Send invitation
teamRoutes.post("/:teamId/invite", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const teamId = c.req.param("teamId");

  // Must be admin or owner
  const membership = await teamQueries(db).getMembership(teamId, userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      403,
    );
  }

  const body = z
    .object({
      email: z.string().email(),
      role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
    })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Valid email required" } },
      422,
    );
  }

  const invitation = await teamQueries(db).createInvitation(
    teamId,
    body.data.email,
    body.data.role,
  );
  return c.json({ data: invitation }, 201);
});

// POST /accept-invite — Accept invitation via token
teamRoutes.post("/accept-invite", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = z.object({ token: z.string() }).safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Token is required" } },
      422,
    );
  }

  const invitation = await teamQueries(db).getInvitationByToken(
    body.data.token,
  );
  if (!invitation) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Invitation not found" } },
      404,
    );
  }

  if (invitation.expiresAt < new Date()) {
    return c.json(
      { error: { code: "EXPIRED", message: "Invitation has expired" } },
      410,
    );
  }

  const member = await teamQueries(db).addMember(
    invitation.teamId,
    userId,
    invitation.role as "admin" | "editor" | "viewer",
  );
  await teamQueries(db).deleteInvitation(invitation.id);

  return c.json({ data: member }, 201);
});

// PATCH /:teamId/members/:memberId — Update role
teamRoutes.patch("/:teamId/members/:memberId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const teamId = c.req.param("teamId");
  const memberId = c.req.param("memberId");

  const membership = await teamQueries(db).getMembership(teamId, userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      403,
    );
  }

  const body = z
    .object({ role: z.enum(["admin", "editor", "viewer"]) })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Valid role required" } },
      422,
    );
  }

  const updated = await teamQueries(db).updateMemberRole(
    teamId,
    memberId,
    body.data.role,
  );
  return c.json({ data: updated });
});

// DELETE /:teamId/members/:memberId — Remove member
teamRoutes.delete("/:teamId/members/:memberId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const teamId = c.req.param("teamId");
  const memberId = c.req.param("memberId");

  const membership = await teamQueries(db).getMembership(teamId, userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      403,
    );
  }

  await teamQueries(db).removeMember(teamId, memberId);
  return c.json({ data: { removed: true } });
});
