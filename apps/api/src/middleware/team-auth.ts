import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { teamQueries } from "@llm-boost/db";

const ROLE_LEVELS: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function requireTeamRole(
  minRole: "viewer" | "editor" | "admin" | "owner",
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const teamId = c.req.param("teamId") ?? c.req.query("teamId");

    if (!teamId) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "teamId is required" } },
        400,
      );
    }

    const membership = await teamQueries(db).getMembership(teamId, userId);
    if (!membership) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Not a team member" } },
        403,
      );
    }

    const userLevel = ROLE_LEVELS[membership.role] ?? 0;
    const requiredLevel = ROLE_LEVELS[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `Requires ${minRole} role or higher`,
          },
        },
        403,
      );
    }

    c.set("teamRole" as never, membership.role as never);
    c.set("teamId" as never, teamId as never);

    await next();
  };
}
