import type { Database } from "@llm-boost/db";
import { projectQueries, teamQueries, orgMemberQueries } from "@llm-boost/db";
import {
  hasPermission,
  hasTeamPermission,
  type Permission,
  type OrgRole,
  type TeamRole,
} from "@llm-boost/shared";
import { ServiceError } from "./errors";

export interface AuthorizationContext {
  userId: string;
  orgId?: string;
  teamId?: string;
}

export interface ProjectAccessResult {
  allowed: boolean;
  role: OrgRole | TeamRole | "owner" | null;
  source: "owner" | "team" | "org" | null;
}

export function createAuthorizationService(db: Database) {
  const projects = projectQueries(db);
  const teams = teamQueries(db);
  const orgMembers = orgMemberQueries(db);

  /**
   * Check if user can access a project
   */
  async function canAccessProject(
    userId: string,
    projectId: string,
    permission: Permission,
  ): Promise<ProjectAccessResult> {
    // Get project details
    const project = await projects.getById(projectId);
    if (!project) {
      return { allowed: false, role: null, source: null };
    }

    // 1. Check if user owns the project directly
    if (project.userId === userId) {
      return { allowed: true, role: "owner", source: "owner" };
    }

    // 2. Check team membership if project belongs to a team
    if (project.teamId) {
      const membership = await teams.getMembership(project.teamId, userId);
      if (membership) {
        const allowed = hasTeamPermission(
          membership.role as TeamRole,
          permission,
        );
        return {
          allowed,
          role: membership.role as TeamRole,
          source: "team",
        };
      }
    }

    // 3. Check organization membership (future: when projects can belong to orgs)
    // This would be implemented when org-level project ownership is added

    return { allowed: false, role: null, source: null };
  }

  /**
   * Require permission to access a project, throws if denied
   */
  async function requireProjectPermission(
    userId: string,
    projectId: string,
    permission: Permission,
  ): Promise<ProjectAccessResult> {
    const access = await canAccessProject(userId, projectId, permission);

    if (!access.allowed) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        `Missing permission: ${permission} for project`,
      );
    }

    return access;
  }

  /**
   * Check if user can access a team
   */
  async function canAccessTeam(
    userId: string,
    teamId: string,
    permission: Permission,
  ): Promise<{ allowed: boolean; role: TeamRole | null }> {
    const membership = await teams.getMembership(teamId, userId);
    if (!membership) {
      return { allowed: false, role: null };
    }

    const allowed = hasTeamPermission(membership.role as TeamRole, permission);
    return { allowed, role: membership.role as TeamRole };
  }

  /**
   * Require permission to access a team, throws if denied
   */
  async function requireTeamPermission(
    userId: string,
    teamId: string,
    permission: Permission,
  ): Promise<TeamRole> {
    const access = await canAccessTeam(userId, teamId, permission);

    if (!access.allowed || !access.role) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        `Missing permission: ${permission} for team`,
      );
    }

    return access.role;
  }

  /**
   * Check if user can access an organization
   */
  async function canAccessOrganization(
    userId: string,
    orgId: string,
    permission: Permission,
  ): Promise<{ allowed: boolean; role: OrgRole | null }> {
    const membership = await orgMembers.getMembership(orgId, userId);
    if (!membership) {
      return { allowed: false, role: null };
    }

    const allowed = hasPermission(membership.role as OrgRole, permission);
    return { allowed, role: membership.role as OrgRole };
  }

  /**
   * Require permission to access an organization, throws if denied
   */
  async function requireOrganizationPermission(
    userId: string,
    orgId: string,
    permission: Permission,
  ): Promise<OrgRole> {
    const access = await canAccessOrganization(userId, orgId, permission);

    if (!access.allowed || !access.role) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        `Missing permission: ${permission} for organization`,
      );
    }

    return access.role;
  }

  /**
   * List all projects the user has access to with their effective permissions
   */
  async function listAccessibleProjects(userId: string) {
    // Get projects user owns directly
    const ownedProjects = await projects.listByUser(userId);

    // Get user's teams
    const userTeamMemberships = await teams.listByUser(userId);
    const teamIds = userTeamMemberships.map((tm) => tm.membership.teamId);

    // Get projects belonging to those teams
    const teamProjects =
      teamIds.length > 0 ? await projects.listByTeams(teamIds) : [];

    // Combine and deduplicate
    const projectMap = new Map<
      string,
      {
        project: (typeof ownedProjects)[0];
        role: "owner" | TeamRole;
        source: "owner" | "team";
      }
    >();

    // Add owned projects
    for (const project of ownedProjects) {
      projectMap.set(project.id, {
        project,
        role: "owner",
        source: "owner",
      });
    }

    // Add team projects (only if not already owned)
    for (const project of teamProjects) {
      if (!projectMap.has(project.id) && project.teamId) {
        const membership = userTeamMemberships.find(
          (tm) => tm.membership.teamId === project.teamId,
        );
        if (membership) {
          projectMap.set(project.id, {
            project,
            role: membership.membership.role as TeamRole,
            source: "team",
          });
        }
      }
    }

    return Array.from(projectMap.values());
  }

  /**
   * Batch check permissions for multiple projects
   */
  async function batchCheckProjectPermissions(
    userId: string,
    projectIds: string[],
    permission: Permission,
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      projectIds.map(async (projectId) => {
        const access = await canAccessProject(userId, projectId, permission);
        results.set(projectId, access.allowed);
      }),
    );

    return results;
  }

  return {
    canAccessProject,
    requireProjectPermission,
    canAccessTeam,
    requireTeamPermission,
    canAccessOrganization,
    requireOrganizationPermission,
    listAccessibleProjects,
    batchCheckProjectPermissions,
  };
}

export type AuthorizationService = ReturnType<
  typeof createAuthorizationService
>;
