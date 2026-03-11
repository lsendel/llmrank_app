import type { Context, Next } from "hono";
import type { AppEnv } from "../index";
import { createAuthorizationService } from "../services/authorization-service";
import { type Permission } from "@llm-boost/shared";

/**
 * Middleware factory to require permission for a project
 *
 * Usage:
 * app.get("/api/projects/:id", requireProjectPermission("project.read"), handler)
 */
export function requireProjectPermission(permission: Permission) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const projectId = c.req.param("id") || c.req.param("projectId");

    if (!userId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401,
      );
    }

    if (!projectId) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Project ID required" } },
        400,
      );
    }

    const db = c.get("db");
    const authService = createAuthorizationService(db);

    try {
      const access = await authService.requireProjectPermission(
        userId,
        projectId,
        permission,
      );

      // Store access context for use in handlers
      c.set("projectAccess" as any, access);

      await next();
    } catch (err: any) {
      if (err.code === "FORBIDDEN") {
        return c.json(
          { error: { code: "FORBIDDEN", message: err.message } },
          403,
        );
      }
      throw err;
    }
  };
}

/**
 * Middleware factory to require permission for a team
 *
 * Usage:
 * app.get("/api/teams/:teamId", requireTeamPermission("member.invite"), handler)
 */
export function requireTeamPermission(permission: Permission) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const teamId = c.req.param("teamId") || c.req.param("id");

    if (!userId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401,
      );
    }

    if (!teamId) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Team ID required" } },
        400,
      );
    }

    const db = c.get("db");
    const authService = createAuthorizationService(db);

    try {
      const role = await authService.requireTeamPermission(
        userId,
        teamId,
        permission,
      );

      // Store role for use in handlers
      c.set("teamRole" as any, role);

      await next();
    } catch (err: any) {
      if (err.code === "FORBIDDEN") {
        return c.json(
          { error: { code: "FORBIDDEN", message: err.message } },
          403,
        );
      }
      throw err;
    }
  };
}

/**
 * Middleware factory to require permission for an organization
 *
 * Usage:
 * app.get("/api/orgs/:orgId", requireOrganizationPermission("billing.manage"), handler)
 */
export function requireOrganizationPermission(permission: Permission) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const orgId = c.req.param("orgId") || c.req.param("id");

    if (!userId) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401,
      );
    }

    if (!orgId) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Organization ID required" } },
        400,
      );
    }

    const db = c.get("db");
    const authService = createAuthorizationService(db);

    try {
      const role = await authService.requireOrganizationPermission(
        userId,
        orgId,
        permission,
      );

      // Store role for use in handlers
      c.set("orgRole" as any, role);

      await next();
    } catch (err: any) {
      if (err.code === "FORBIDDEN") {
        return c.json(
          { error: { code: "FORBIDDEN", message: err.message } },
          403,
        );
      }
      throw err;
    }
  };
}

/**
 * Helper to check multiple permissions (user needs ALL of them)
 *
 * Usage:
 * app.post("/api/projects/:id/delete",
 *   requireProjectPermissions(["project.delete", "crawl.read"]),
 *   handler
 * )
 */
export function requireProjectPermissions(permissions: Permission[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const projectId = c.req.param("id") || c.req.param("projectId");

    if (!userId || !projectId) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401,
      );
    }

    const db = c.get("db");
    const authService = createAuthorizationService(db);

    try {
      // Check all permissions
      for (const permission of permissions) {
        await authService.requireProjectPermission(
          userId,
          projectId,
          permission,
        );
      }

      await next();
    } catch (err: any) {
      if (err.code === "FORBIDDEN") {
        return c.json(
          { error: { code: "FORBIDDEN", message: err.message } },
          403,
        );
      }
      throw err;
    }
  };
}
