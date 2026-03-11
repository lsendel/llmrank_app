# Role-Based Access Control (RBAC)

LLM Rank implements a comprehensive RBAC system for team collaboration and organization management.

## Overview

**Current State:** RBAC enabled for Organizations and Teams
**Permissions:** 16 granular permissions across resources
**Roles:** 4 organization roles, 4 team roles

## Roles & Permissions

### Organization Roles

| Role       | Description                             | Use Case                                |
| ---------- | --------------------------------------- | --------------------------------------- |
| **Owner**  | Full control including billing and SSO  | Company founder, primary account holder |
| **Admin**  | Manage members and projects, no billing | Team lead, operations manager           |
| **Member** | Create and manage own projects          | Individual contributor, SEO specialist  |
| **Viewer** | Read-only access to projects and crawls | Client, stakeholder, auditor            |

### Team Roles

| Role       | Description                        | Use Case                    |
| ---------- | ---------------------------------- | --------------------------- |
| **Owner**  | Full team control, can delete team | Team creator                |
| **Admin**  | Manage members and projects        | Project manager             |
| **Editor** | Edit projects, run crawls          | SEO analyst, content editor |
| **Viewer** | Read-only access                   | Client, report recipient    |

## Permission Matrix

### Organization Permissions

| Permission           | Owner | Admin | Member | Viewer |
| -------------------- | :---: | :---: | :----: | :----: |
| `project.create`     |  ✅   |  ✅   |   ✅   |   ❌   |
| `project.read`       |  ✅   |  ✅   |   ✅   |   ✅   |
| `project.update`     |  ✅   |  ✅   |   ✅   |   ❌   |
| `project.delete`     |  ✅   |  ✅   |   ❌   |   ❌   |
| `crawl.start`        |  ✅   |  ✅   |   ✅   |   ❌   |
| `crawl.read`         |  ✅   |  ✅   |   ✅   |   ✅   |
| `fix.generate`       |  ✅   |  ✅   |   ✅   |   ❌   |
| `fix.apply`          |  ✅   |  ✅   |   ✅   |   ❌   |
| `member.invite`      |  ✅   |  ✅   |   ❌   |   ❌   |
| `member.remove`      |  ✅   |  ✅   |   ❌   |   ❌   |
| `member.role_change` |  ✅   |  ✅   |   ❌   |   ❌   |
| `billing.manage`     |  ✅   |  ❌   |   ❌   |   ❌   |
| `settings.update`    |  ✅   |  ✅   |   ❌   |   ❌   |
| `sso.manage`         |  ✅   |  ❌   |   ❌   |   ❌   |
| `audit.view`         |  ✅   |  ✅   |   ❌   |   ❌   |

### Team Permissions

| Permission           | Owner | Admin | Editor | Viewer |
| -------------------- | :---: | :---: | :----: | :----: |
| `project.create`     |  ✅   |  ✅   |   ❌   |   ❌   |
| `project.read`       |  ✅   |  ✅   |   ✅   |   ✅   |
| `project.update`     |  ✅   |  ✅   |   ✅   |   ❌   |
| `project.delete`     |  ✅   |  ❌   |   ❌   |   ❌   |
| `crawl.start`        |  ✅   |  ✅   |   ✅   |   ❌   |
| `crawl.read`         |  ✅   |  ✅   |   ✅   |   ✅   |
| `fix.generate`       |  ✅   |  ✅   |   ✅   |   ❌   |
| `fix.apply`          |  ✅   |  ✅   |   ✅   |   ❌   |
| `member.invite`      |  ✅   |  ✅   |   ❌   |   ❌   |
| `member.remove`      |  ✅   |  ✅   |   ❌   |   ❌   |
| `member.role_change` |  ✅   |  ❌   |   ❌   |   ❌   |
| `settings.update`    |  ✅   |  ✅   |   ❌   |   ❌   |

## Implementation

### Database Schema

**Organizations:**

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free'
);

CREATE TABLE org_members (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations,
  user_id TEXT NOT NULL REFERENCES users,
  role TEXT NOT NULL, -- 'owner' | 'admin' | 'member' | 'viewer'
  UNIQUE(org_id, user_id)
);
```

**Teams:**

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users,
  plan TEXT NOT NULL DEFAULT 'free'
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams,
  user_id TEXT NOT NULL REFERENCES users,
  role TEXT NOT NULL, -- 'owner' | 'admin' | 'editor' | 'viewer'
  UNIQUE(team_id, user_id)
);
```

**Projects** (with team association):

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users, -- Project owner
  team_id UUID REFERENCES teams,           -- Optional team
  name TEXT NOT NULL,
  domain TEXT NOT NULL
);
```

### Authorization Service

**Core Service:**

```typescript
// apps/api/src/services/authorization-service.ts
export function createAuthorizationService(db: Database) {
  return {
    // Project access
    async canAccessProject(userId, projectId, permission): Promise<ProjectAccessResult>
    async requireProjectPermission(userId, projectId, permission): Promise<ProjectAccessResult>

    // Team access
    async canAccessTeam(userId, teamId, permission): Promise<{allowed, role}>
    async requireTeamPermission(userId, teamId, permission): Promise<TeamRole>

    // Organization access
    async canAccessOrganization(userId, orgId, permission): Promise<{allowed, role}>
    async requireOrganizationPermission(userId, orgId, permission): Promise<OrgRole>

    // List resources
    async listAccessibleProjects(userId): Promise<ProjectWithAccess[]>

    // Batch operations
    async batchCheckProjectPermissions(userId, projectIds[], permission): Promise<Map<string, boolean>>
  }
}
```

### RBAC Middleware

**Route Protection:**

```typescript
import { requireProjectPermission } from "./middleware/rbac";

// Protect individual routes
app.get(
  "/api/projects/:id",
  requireProjectPermission("project.read"),
  async (c) => {
    // Handler has access to c.get("projectAccess")
    const access = c.get("projectAccess");
    // access = { allowed: true, role: "admin", source: "team" }
  },
);

// Require multiple permissions
app.delete(
  "/api/projects/:id",
  requireProjectPermissions(["project.delete", "crawl.read"]),
  async (c) => {
    // User must have ALL specified permissions
  },
);

// Team protection
app.post(
  "/api/teams/:teamId/invite",
  requireTeamPermission("member.invite"),
  async (c) => {
    const role = c.get("teamRole"); // "owner" | "admin" | etc.
  },
);

// Organization protection
app.patch(
  "/api/orgs/:orgId/billing",
  requireOrganizationPermission("billing.manage"),
  async (c) => {
    // Only org owners can access this
  },
);
```

## Access Resolution

### Project Access Priority

When checking project access, the system checks in this order:

1. **Direct Ownership**: User owns the project (`project.userId === userId`)
2. **Team Membership**: Project belongs to a team where user is a member
3. **Organization Membership**: (Future) Project belongs to an organization

**Example:**

```typescript
const access = await authService.canAccessProject(
  "user123",
  "proj-abc",
  "project.update"
);

// Returns:
{
  allowed: true,
  role: "editor",      // User's team role
  source: "team"       // Access granted via team
}
```

### Access Precedence

If a user has multiple sources of access to a project:

- **Owner** access takes precedence over team/org access
- Direct ownership = full permissions regardless of team role

## Usage Examples

### Invite Team Member

```typescript
// apps/api/src/routes/teams.ts
import { requireTeamPermission } from "../middleware/rbac";

app.post(
  "/api/teams/:teamId/members/invite",
  requireTeamPermission("member.invite"),
  async (c) => {
    const { email, role } = await c.req.json();
    const teamId = c.req.param("teamId");

    // Only admins and owners can reach this point
    const invitation = await teamService.inviteMember(teamId, email, role);

    return c.json({ invitation }, 201);
  },
);
```

### List Accessible Projects

```typescript
app.get("/api/projects", auth, async (c) => {
  const userId = c.get("userId");
  const authService = createAuthorizationService(c.get("db"));

  // Returns projects user owns + team projects
  const projects = await authService.listAccessibleProjects(userId);

  return c.json({
    projects: projects.map((p) => ({
      ...p.project,
      effectiveRole: p.role, // "owner" | "admin" | "editor" | "viewer"
      accessSource: p.source, // "owner" | "team"
    })),
  });
});
```

### Update Project Settings

```typescript
app.patch(
  "/api/projects/:id/settings",
  requireProjectPermission("project.update"),
  async (c) => {
    const projectId = c.req.param("id");
    const access = c.get("projectAccess");

    // Log who made the change
    logger.info("Project settings updated", {
      projectId,
      role: access.role,
      source: access.source,
    });

    // Apply update...
  },
);
```

### Batch Permission Check

```typescript
app.get("/api/dashboard", auth, async (c) => {
  const userId = c.get("userId");
  const authService = createAuthorizationService(c.get("db"));

  // Get all projects user has access to
  const projects = await authService.listAccessibleProjects(userId);
  const projectIds = projects.map((p) => p.project.id);

  // Check which ones user can delete (batch operation)
  const deletePermissions = await authService.batchCheckProjectPermissions(
    userId,
    projectIds,
    "project.delete",
  );

  return c.json({
    projects: projects.map((p) => ({
      ...p.project,
      canDelete: deletePermissions.get(p.project.id) ?? false,
    })),
  });
});
```

## Audit Logging

All permission checks and role changes are logged to the audit log:

```typescript
// Automatic logging in organization-service.ts
await logAudit(db, {
  orgId,
  actorId: userId,
  action: "member.role_changed",
  resourceType: "member",
  resourceId: memberId,
  metadata: { previousRole: "viewer", newRole: "admin" },
});
```

**Query audit logs:**

```sql
SELECT * FROM audit_logs
WHERE org_id = 'org-123'
  AND action = 'member.role_changed'
ORDER BY created_at DESC;
```

## Testing RBAC

### Unit Tests

```typescript
describe("AuthorizationService", () => {
  it("allows team admin to invite members", async () => {
    const access = await authService.canAccessTeam(
      "admin-user",
      "team-id",
      "member.invite",
    );

    expect(access.allowed).toBe(true);
    expect(access.role).toBe("admin");
  });

  it("denies team viewer from deleting projects", async () => {
    const access = await authService.canAccessProject(
      "viewer-user",
      "project-id",
      "project.delete",
    );

    expect(access.allowed).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe("RBAC Middleware", () => {
  it("blocks non-member from accessing team project", async () => {
    const app = createApp();

    const res = await app.request("/api/projects/team-project-123", {
      headers: { Authorization: "Bearer non-member-token" },
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });
});
```

## Migration Guide

### Existing Projects

When enabling teams for existing projects:

1. Projects remain owned by original user
2. Owner can optionally assign project to a team
3. Team members gain access based on their team role
4. Original owner retains owner-level access

**Example migration:**

```typescript
// Assign existing project to team
await db
  .update(projects)
  .set({ teamId: "team-123" })
  .where(eq(projects.id, "proj-abc"));

// Original owner still has full access
// Team members now have access based on their team role
```

## Security Considerations

1. **Principle of Least Privilege**: Users only get permissions they need
2. **No Permission Escalation**: Members cannot elevate their own roles
3. **Owner Protection**: Cannot remove the last owner of an organization/team
4. **Audit Trail**: All permission changes are logged
5. **Invitation Expiry**: Invites expire after 7 days
6. **Token Security**: Invitation tokens are cryptographically random

## Future Enhancements

### Planned Features

- **Custom Roles**: Define custom roles with specific permission sets
- **Resource-Level Permissions**: Fine-grained access control per project/crawl
- **Temporary Access**: Time-limited elevated permissions
- **External Groups**: Sync roles from SSO/LDAP groups
- **Permission Policies**: JSON-based permission policies for complex scenarios
- **Delegation**: Temporary permission delegation without role change

### Roadmap

- **Q2 2026**: Organization-level project ownership
- **Q3 2026**: Custom roles and permission policies
- **Q4 2026**: SSO group mapping and external authentication

## FAQ

**Q: Can a user be in multiple teams?**
A: Yes, users can be members of multiple teams with different roles in each.

**Q: What happens when a project owner leaves a team?**
A: The project owner retains ownership. Projects are owned by users, teams provide collaborative access.

**Q: Can viewers run crawls?**
A: No, viewers have read-only access. They can view projects and crawl results but cannot trigger new crawls.

**Q: How do I change someone's role?**
A: As an admin or owner, use the team/org management UI or API endpoint with `member.role_change` permission.

**Q: What's the difference between teams and organizations?**
A: Teams are lightweight collaboration units. Organizations are enterprise-level with billing, SSO, and advanced features. Most users will use teams.

## Resources

- Authorization Service: `apps/api/src/services/authorization-service.ts`
- RBAC Middleware: `apps/api/src/middleware/rbac.ts`
- Permission Definitions: `packages/shared/src/domain/permissions.ts`
- Database Schema: `packages/db/src/schema/identity.ts`
- Tests: `apps/api/src/__tests__/services/authorization-service.test.ts`
