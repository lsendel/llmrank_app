# Agency Features Bundle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship 6 features (Teams/RBAC, Digests, White-Label Branding, Scoring Profiles, Bulk Export, WordPress Plugin) to attract Agency-tier customers.

**Architecture:** Most features have frontend components and schema tables already in place. The work is creating backend services, API routes, and wiring everything together. New routes follow the Hono + authMiddleware + container pattern. New services use factory functions with dependency injection.

**Tech Stack:** Hono (API), Drizzle ORM + Neon PostgreSQL (DB), Next.js App Router (frontend), SWR (data fetching), Radix UI + Tailwind (components), Vitest (testing)

---

## Phase 1: Teams & RBAC + Email Digests (Wire Existing Code)

### Task 1: Organization Queries Module

**Files:**

- Create: `packages/db/src/queries/organizations.ts`
- Modify: `packages/db/src/index.ts`

**Context:** Schema tables `organizations`, `orgMembers`, `orgInvites`, `auditLogs` already exist in `packages/db/src/schema.ts:863-990`. The `orgRoleEnum` uses `["owner", "admin", "member"]`. The frontend (`team-section.tsx`) expects these API endpoints: `GET /api/orgs`, `POST /api/orgs`, `GET /api/orgs/:id/members`, `POST /api/orgs/:id/invites`, `PATCH /api/orgs/:id/members/:memberId`, `DELETE /api/orgs/:id/members/:memberId`.

**Step 1: Create organization queries**

Create `packages/db/src/queries/organizations.ts`:

```typescript
import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  organizations,
  orgMembers,
  orgInvites,
  auditLogs,
  users,
  orgRoleEnum,
  planEnum,
} from "../schema";

type OrgRole = (typeof orgRoleEnum.enumValues)[number];
type Plan = (typeof planEnum.enumValues)[number];

export function organizationQueries(db: Database) {
  return {
    async create(data: { name: string; slug: string; plan?: Plan }) {
      const [org] = await db
        .insert(organizations)
        .values({ name: data.name, slug: data.slug, plan: data.plan ?? "free" })
        .returning();
      return org;
    },

    async getById(id: string) {
      return db.query.organizations.findFirst({
        where: eq(organizations.id, id),
      });
    },

    async getBySlug(slug: string) {
      return db.query.organizations.findFirst({
        where: eq(organizations.slug, slug),
      });
    },

    async update(id: string, data: Partial<typeof organizations.$inferInsert>) {
      const [row] = await db
        .update(organizations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning();
      return row;
    },

    async delete(id: string) {
      await db.delete(organizations).where(eq(organizations.id, id));
    },
  };
}

export function orgMemberQueries(db: Database) {
  return {
    async add(data: {
      orgId: string;
      userId: string;
      role: OrgRole;
      invitedBy?: string;
    }) {
      const [row] = await db
        .insert(orgMembers)
        .values({
          orgId: data.orgId,
          userId: data.userId,
          role: data.role,
          invitedBy: data.invitedBy,
        })
        .returning();
      return row;
    },

    async findByOrgAndUser(orgId: string, userId: string) {
      return db.query.orgMembers.findFirst({
        where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
      });
    },

    async listByOrg(orgId: string) {
      return db
        .select({
          id: orgMembers.id,
          userId: orgMembers.userId,
          name: users.name,
          email: users.email,
          role: orgMembers.role,
          joinedAt: orgMembers.joinedAt,
        })
        .from(orgMembers)
        .innerJoin(users, eq(orgMembers.userId, users.id))
        .where(eq(orgMembers.orgId, orgId))
        .orderBy(orgMembers.joinedAt);
    },

    async listByUser(userId: string) {
      return db
        .select({ org: organizations, role: orgMembers.role })
        .from(orgMembers)
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        .where(eq(orgMembers.userId, userId))
        .orderBy(desc(organizations.createdAt));
    },

    async updateRole(id: string, role: OrgRole) {
      const [row] = await db
        .update(orgMembers)
        .set({ role })
        .where(eq(orgMembers.id, id))
        .returning();
      return row;
    },

    async remove(id: string) {
      await db.delete(orgMembers).where(eq(orgMembers.id, id));
    },
  };
}

export function orgInviteQueries(db: Database) {
  return {
    async create(data: {
      orgId: string;
      email: string;
      role: OrgRole;
      token: string;
      invitedBy: string;
      expiresAt: Date;
    }) {
      const [row] = await db.insert(orgInvites).values(data).returning();
      return row;
    },

    async getByToken(token: string) {
      return db.query.orgInvites.findFirst({
        where: eq(orgInvites.token, token),
      });
    },

    async listByOrg(orgId: string) {
      return db
        .select()
        .from(orgInvites)
        .where(eq(orgInvites.orgId, orgId))
        .orderBy(desc(orgInvites.createdAt));
    },

    async markAccepted(id: string) {
      const [row] = await db
        .update(orgInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(orgInvites.id, id))
        .returning();
      return row;
    },
  };
}

export function auditLogQueries(db: Database) {
  return {
    async create(data: typeof auditLogs.$inferInsert) {
      const [row] = await db.insert(auditLogs).values(data).returning();
      return row;
    },

    async listByOrg(
      orgId: string,
      opts: {
        limit?: number;
        offset?: number;
        action?: string;
        since?: string;
      },
    ) {
      const conditions = [eq(auditLogs.orgId, orgId)];
      if (opts.action) {
        conditions.push(sql`${auditLogs.action} ILIKE ${`%${opts.action}%`}`);
      }
      if (opts.since) {
        conditions.push(sql`${auditLogs.createdAt} >= ${opts.since}`);
      }

      const rows = await db
        .select({
          id: auditLogs.id,
          timestamp: auditLogs.createdAt,
          actorId: auditLogs.actorId,
          actorEmail: users.email,
          actorName: users.name,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          metadata: auditLogs.metadata,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(opts.limit ?? 50)
        .offset(opts.offset ?? 0);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(and(...conditions));

      return { data: rows, total: count };
    },
  };
}
```

**Step 2: Export from db index**

Add to `packages/db/src/index.ts`:

```typescript
export {
  organizationQueries,
  orgMemberQueries,
  orgInviteQueries,
  auditLogQueries,
} from "./queries/organizations";
```

**Step 3: Run typecheck**

Run: `cd packages/db && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/db/src/queries/organizations.ts packages/db/src/index.ts
git commit -m "feat(db): add organization, member, invite, and audit log queries"
```

---

### Task 2: Organization Service

**Files:**

- Create: `apps/api/src/services/organization-service.ts`
- Create: `apps/api/src/lib/audit.ts`

**Context:** Uses the permission matrix from `packages/shared/src/domain/permissions.ts` which exports `hasPermission(role, permission)`. The service follows the factory-function pattern used by `createProjectService` in `apps/api/src/services/project-service.ts`. Uses `ServiceError` from `apps/api/src/services/errors.ts`.

**Step 1: Create audit helper**

Create `apps/api/src/lib/audit.ts`:

```typescript
import type { Database } from "@llm-boost/db";
import { auditLogQueries } from "@llm-boost/db";

export async function logAudit(
  db: Database,
  data: {
    orgId?: string;
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  },
) {
  const q = auditLogQueries(db);
  await q.create({
    orgId: data.orgId ?? undefined,
    actorId: data.actorId,
    action: data.action,
    resourceType: data.resourceType ?? null,
    resourceId: data.resourceId ?? null,
    metadata: data.metadata ?? {},
    ipAddress: data.ipAddress ?? null,
  });
}
```

**Step 2: Create organization service**

Create `apps/api/src/services/organization-service.ts`:

```typescript
import type { Database } from "@llm-boost/db";
import {
  organizationQueries,
  orgMemberQueries,
  orgInviteQueries,
} from "@llm-boost/db";
import { hasPermission, type OrgRole, Permission } from "@llm-boost/shared";
import { ServiceError } from "./errors";
import { logAudit } from "../lib/audit";

export function createOrganizationService(db: Database) {
  const orgs = organizationQueries(db);
  const members = orgMemberQueries(db);
  const invites = orgInviteQueries(db);

  async function requireRole(orgId: string, userId: string): Promise<OrgRole> {
    const membership = await members.findByOrgAndUser(orgId, userId);
    if (!membership) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        "Not a member of this organization",
      );
    }
    return membership.role as OrgRole;
  }

  async function requirePermission(
    orgId: string,
    userId: string,
    permission: Permission,
  ): Promise<OrgRole> {
    const role = await requireRole(orgId, userId);
    if (!hasPermission(role, permission)) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        `Insufficient permissions: ${permission}`,
      );
    }
    return role;
  }

  return {
    async create(userId: string, data: { name: string; slug: string }) {
      const existing = await orgs.getBySlug(data.slug);
      if (existing) {
        throw new ServiceError(
          "CONFLICT",
          409,
          "Organization slug already taken",
        );
      }

      const org = await orgs.create({ name: data.name, slug: data.slug });
      await members.add({ orgId: org.id, userId, role: "owner" });
      await logAudit(db, {
        orgId: org.id,
        actorId: userId,
        action: "org.create",
        resourceType: "organization",
        resourceId: org.id,
      });
      return org;
    },

    async getForUser(userId: string) {
      const userOrgs = await members.listByUser(userId);
      if (userOrgs.length === 0) return null;
      return userOrgs[0].org;
    },

    async getById(orgId: string, userId: string) {
      await requireRole(orgId, userId);
      return orgs.getById(orgId);
    },

    async listMembers(orgId: string, userId: string) {
      await requireRole(orgId, userId);
      return members.listByOrg(orgId);
    },

    async inviteMember(
      orgId: string,
      actorId: string,
      data: { email: string; role: OrgRole },
    ) {
      await requirePermission(orgId, actorId, Permission.MEMBER_INVITE);

      const token = crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await invites.create({
        orgId,
        email: data.email,
        role: data.role,
        token,
        invitedBy: actorId,
        expiresAt,
      });

      await logAudit(db, {
        orgId,
        actorId,
        action: "member.invite",
        resourceType: "invite",
        resourceId: invite.id,
        metadata: { email: data.email, role: data.role },
      });

      return invite;
    },

    async acceptInvite(token: string, userId: string) {
      const invite = await invites.getByToken(token);
      if (!invite) {
        throw new ServiceError("NOT_FOUND", 404, "Invitation not found");
      }
      if (invite.acceptedAt) {
        throw new ServiceError("CONFLICT", 409, "Invitation already accepted");
      }
      if (new Date(invite.expiresAt) < new Date()) {
        throw new ServiceError("GONE", 410, "Invitation has expired");
      }

      await members.add({
        orgId: invite.orgId,
        userId,
        role: invite.role as OrgRole,
        invitedBy: invite.invitedBy,
      });
      await invites.markAccepted(invite.id);

      await logAudit(db, {
        orgId: invite.orgId,
        actorId: userId,
        action: "member.join",
        resourceType: "member",
        resourceId: userId,
      });

      return invite;
    },

    async listInvites(orgId: string, userId: string) {
      await requirePermission(orgId, userId, Permission.MEMBER_INVITE);
      const all = await invites.listByOrg(orgId);
      return all.map((inv) => ({
        ...inv,
        status: inv.acceptedAt
          ? "accepted"
          : new Date(inv.expiresAt) < new Date()
            ? "expired"
            : "pending",
      }));
    },

    async changeMemberRole(
      orgId: string,
      actorId: string,
      memberId: string,
      newRole: OrgRole,
    ) {
      await requirePermission(orgId, actorId, Permission.MEMBER_ROLE_CHANGE);
      const updated = await members.updateRole(memberId, newRole);

      await logAudit(db, {
        orgId,
        actorId,
        action: "member.role_change",
        resourceType: "member",
        resourceId: memberId,
        metadata: { newRole },
      });

      return updated;
    },

    async removeMember(orgId: string, actorId: string, memberId: string) {
      await requirePermission(orgId, actorId, Permission.MEMBER_REMOVE);
      await members.remove(memberId);

      await logAudit(db, {
        orgId,
        actorId,
        action: "member.remove",
        resourceType: "member",
        resourceId: memberId,
      });
    },
  };
}
```

**Step 3: Run typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS (or fix any import path issues)

**Step 4: Commit**

```bash
git add apps/api/src/services/organization-service.ts apps/api/src/lib/audit.ts
git commit -m "feat(api): add organization service with RBAC and audit logging"
```

---

### Task 3: Organization API Routes + Mount

**Files:**

- Create: `apps/api/src/routes/organizations.ts`
- Modify: `apps/api/src/index.ts:191` (mount route before auth fallback)

**Context:** The frontend `team-section.tsx` calls these paths: `GET /api/orgs` (returns user's org), `POST /api/orgs` (create), `GET /api/orgs/:id/members`, `POST /api/orgs/:id/invites`, `PATCH /api/orgs/:id/members/:memberId`, `DELETE /api/orgs/:id/members/:memberId`, `GET /api/orgs/:id/audit-log`. The audit-log-section.tsx calls `GET /api/orgs/:id/audit-log?limit=&offset=&action=&since=`.

**Step 1: Create the route file**

Create `apps/api/src/routes/organizations.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createOrganizationService } from "../services/organization-service";
import { auditLogQueries } from "@llm-boost/db";
import { z } from "zod";
import { handleServiceError } from "../services/errors";

export const organizationRoutes = new Hono<AppEnv>();
organizationRoutes.use("*", authMiddleware);

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
});

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

const ChangeRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

organizationRoutes.get("/", async (c) => {
  const service = createOrganizationService(c.get("db"));
  const org = await service.getForUser(c.get("userId"));
  return c.json({ data: org });
});

organizationRoutes.post("/", async (c) => {
  const body = CreateOrgSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }
  try {
    const service = createOrganizationService(c.get("db"));
    const org = await service.create(c.get("userId"), body.data);
    return c.json({ data: org }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.get("/:id/members", async (c) => {
  try {
    const service = createOrganizationService(c.get("db"));
    const membersList = await service.listMembers(
      c.req.param("id"),
      c.get("userId"),
    );
    return c.json({ data: membersList });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.post("/:id/invites", async (c) => {
  const body = InviteSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }
  try {
    const service = createOrganizationService(c.get("db"));
    const invite = await service.inviteMember(
      c.req.param("id"),
      c.get("userId"),
      body.data,
    );
    return c.json({ data: invite }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.get("/:id/invites", async (c) => {
  try {
    const service = createOrganizationService(c.get("db"));
    const invitesList = await service.listInvites(
      c.req.param("id"),
      c.get("userId"),
    );
    return c.json({ data: invitesList });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.post("/accept-invite", async (c) => {
  const { token } = await c.req.json<{ token: string }>();
  try {
    const service = createOrganizationService(c.get("db"));
    const invite = await service.acceptInvite(token, c.get("userId"));
    return c.json({ data: invite });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.patch("/:id/members/:memberId", async (c) => {
  const body = ChangeRoleSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid role" } },
      422,
    );
  }
  try {
    const service = createOrganizationService(c.get("db"));
    const updated = await service.changeMemberRole(
      c.req.param("id"),
      c.get("userId"),
      c.req.param("memberId"),
      body.data.role,
    );
    return c.json({ data: updated });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.delete("/:id/members/:memberId", async (c) => {
  try {
    const service = createOrganizationService(c.get("db"));
    await service.removeMember(
      c.req.param("id"),
      c.get("userId"),
      c.req.param("memberId"),
    );
    return c.json({ data: { ok: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

organizationRoutes.get("/:id/audit-log", async (c) => {
  try {
    const service = createOrganizationService(c.get("db"));
    await service.getById(c.req.param("id"), c.get("userId"));
    const auditQ = auditLogQueries(c.get("db"));
    const result = await auditQ.listByOrg(c.req.param("id"), {
      limit: Number(c.req.query("limit")) || 50,
      offset: Number(c.req.query("offset")) || 0,
      action: c.req.query("action") ?? undefined,
      since: c.req.query("since") ?? undefined,
    });
    return c.json({
      data: result.data.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        actorEmail: r.actorEmail,
        actorName: r.actorName,
        action: r.action,
        resource: [r.resourceType, r.resourceId].filter(Boolean).join("/"),
        details: r.metadata ? JSON.stringify(r.metadata) : null,
      })),
      total: result.total,
      hasMore: (Number(c.req.query("offset")) || 0) + 50 < result.total,
    });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Mount in index.ts**

In `apps/api/src/index.ts`, add import and mount at line 191 (before Better Auth routes):

```typescript
import { organizationRoutes } from "./routes/organizations";
app.route("/api/orgs", organizationRoutes);
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/routes/organizations.ts apps/api/src/index.ts
git commit -m "feat(api): add organization routes (CRUD, members, invites, audit log)"
```

---

### Task 4: Push Schema to Neon + Export Shared Permissions

**Files:**

- Modify: `packages/shared/src/index.ts`

**Step 1: Export permissions from shared**

Add to `packages/shared/src/index.ts`:

```typescript
export {
  hasPermission,
  getPermissions,
  OrgRole,
  Permission,
} from "./domain/permissions";
```

**Step 2: Export scoring profile queries from db**

Add to `packages/db/src/index.ts`:

```typescript
export { scoringProfileQueries } from "./queries/scoring-profiles";
```

**Step 3: Push schema**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Tables `organizations`, `org_members`, `org_invites`, `audit_logs`, `scoring_profiles` created

**Step 4: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/db/src/index.ts
git commit -m "feat: export permissions from shared, scoring profile queries from db"
```

---

### Task 5: Wire Digest Preferences UI into Settings

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx:138-140`

**Context:** The `DigestPreferencesSection` at `apps/web/src/components/settings/digest-preferences-section.tsx` is complete but not in the Notifications tab.

**Step 1: Add import and component**

In `apps/web/src/app/dashboard/settings/page.tsx`, add import:

```typescript
import { DigestPreferencesSection } from "@/components/settings/digest-preferences-section";
```

Add after `NotificationChannelsSection` in the notifications `TabsContent`:

```tsx
<TabsContent value="notifications" className="space-y-6">
  <NotificationChannelsSection />
  <DigestPreferencesSection />
</TabsContent>
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx
git commit -m "feat(web): wire digest preferences into settings notifications tab"
```

---

## Phase 2: White-Label Branding + Scoring Profiles

### Task 6: Branding API Routes (Logo Upload + Config Save)

**Files:**

- Create: `apps/api/src/routes/branding.ts`
- Modify: `apps/api/src/index.ts` (mount route)

**Context:** The `projects` table has `branding: jsonb("branding")` at schema line 238. The frontend type expects `{ logoUrl?: string; companyName?: string; primaryColor?: string }`. `Bindings` includes `R2: R2Bucket`.

**Step 1: Create branding routes**

Create `apps/api/src/routes/branding.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import { z } from "zod";
import { ServiceError } from "../services/errors";
import { handleServiceError } from "../services/errors";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";

export const brandingRoutes = new Hono<AppEnv>();
brandingRoutes.use("*", authMiddleware);

const BrandingConfigSchema = z.object({
  companyName: z.string().max(128).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  logoUrl: z.string().url().optional(),
});

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

brandingRoutes.put(
  "/:projectId/branding",
  withOwnership("project"),
  async (c) => {
    const project = c.get("project");
    const body = BrandingConfigSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid branding config",
            details: body.error.flatten(),
          },
        },
        422,
      );
    }

    const { users: userRepo, projects: projectRepo } = c.get("container");
    const user = await userRepo.getById(c.get("userId"));
    const plan = (user?.plan ?? "free") as PlanTier;
    const limits = PLAN_LIMITS[plan];

    if (limits.reportBranding === "none") {
      throw new ServiceError(
        "PLAN_LIMIT_REACHED",
        403,
        "Upgrade to Pro or Agency for report branding",
      );
    }

    const existingBranding =
      (project.branding as Record<string, unknown>) ?? {};
    const updated = { ...existingBranding, ...body.data };
    await projectRepo.update(project.id, { branding: updated });
    return c.json({ data: updated });
  },
);

brandingRoutes.post(
  "/:projectId/branding/logo",
  withOwnership("project"),
  async (c) => {
    const project = c.get("project");
    const { users: userRepo, projects: projectRepo } = c.get("container");
    const user = await userRepo.getById(c.get("userId"));
    const plan = (user?.plan ?? "free") as PlanTier;
    const limits = PLAN_LIMITS[plan];

    if (limits.reportBranding === "none") {
      throw new ServiceError(
        "PLAN_LIMIT_REACHED",
        403,
        "Upgrade for report branding",
      );
    }

    const formData = await c.req.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "No file uploaded" } },
        422,
      );
    }
    if (file.size > MAX_LOGO_SIZE) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "File too large (max 2MB)",
          },
        },
        422,
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Only PNG, JPG, and SVG allowed",
          },
        },
        422,
      );
    }

    const ext =
      file.type.split("/")[1] === "svg+xml" ? "svg" : file.type.split("/")[1];
    const key = `branding/${project.id}/logo.${ext}`;

    await c.env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    const logoUrl = `https://r2.llmboost.com/${key}`;
    const existingBranding =
      (project.branding as Record<string, unknown>) ?? {};
    await projectRepo.update(project.id, {
      branding: { ...existingBranding, logoUrl },
    });
    return c.json({ data: { logoUrl } });
  },
);
```

**Step 2: Mount in index.ts**

```typescript
import { brandingRoutes } from "./routes/branding";
app.route("/api/projects", brandingRoutes);
```

**Step 3: Run typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/api/src/routes/branding.ts apps/api/src/index.ts
git commit -m "feat(api): add branding routes (logo upload to R2, config save)"
```

---

### Task 7: Scoring Profile API Routes

**Files:**

- Create: `apps/api/src/routes/scoring-profiles.ts`
- Modify: `apps/api/src/index.ts` (mount route)
- Modify: `packages/scoring/src/index.ts` (export SCORING_PRESETS)

**Step 1: Export SCORING_PRESETS from scoring package**

Add to `packages/scoring/src/index.ts`:

```typescript
export {
  SCORING_PRESETS,
  normalizeWeights,
  DEFAULT_WEIGHTS,
  type ScoringWeights,
} from "./profiles";
```

**Step 2: Create scoring profile routes**

Create `apps/api/src/routes/scoring-profiles.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { scoringProfileQueries, projectQueries } from "@llm-boost/db";
import { z } from "zod";
import { handleServiceError } from "../services/errors";
import { SCORING_PRESETS } from "@llm-boost/scoring";

export const scoringProfileRoutes = new Hono<AppEnv>();
scoringProfileRoutes.use("*", authMiddleware);

const WeightsSchema = z
  .object({
    technical: z.number().min(0).max(100),
    content: z.number().min(0).max(100),
    aiReadiness: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
  })
  .refine(
    (w) => w.technical + w.content + w.aiReadiness + w.performance === 100,
    {
      message: "Weights must sum to 100",
    },
  );

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(128),
  weights: WeightsSchema,
  preset: z.string().optional(),
});

scoringProfileRoutes.get("/", async (c) => {
  const profiles = await scoringProfileQueries(c.get("db")).listByUser(
    c.get("userId"),
  );
  return c.json({ data: { profiles, presets: SCORING_PRESETS } });
});

scoringProfileRoutes.post("/", async (c) => {
  const body = CreateProfileSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid profile",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }
  const weights =
    body.data.preset && SCORING_PRESETS[body.data.preset]
      ? SCORING_PRESETS[body.data.preset]
      : body.data.weights;
  const profile = await scoringProfileQueries(c.get("db")).create({
    userId: c.get("userId"),
    name: body.data.name,
    weights,
  });
  return c.json({ data: profile }, 201);
});

scoringProfileRoutes.put("/:id", async (c) => {
  const existing = await scoringProfileQueries(c.get("db")).getById(
    c.req.param("id"),
  );
  if (!existing || existing.userId !== c.get("userId")) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Profile not found" } },
      404,
    );
  }
  const body = await c.req.json();
  const updated = await scoringProfileQueries(c.get("db")).update(
    c.req.param("id"),
    body,
  );
  return c.json({ data: updated });
});

scoringProfileRoutes.delete("/:id", async (c) => {
  const existing = await scoringProfileQueries(c.get("db")).getById(
    c.req.param("id"),
  );
  if (!existing || existing.userId !== c.get("userId")) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Profile not found" } },
      404,
    );
  }
  await scoringProfileQueries(c.get("db")).delete(c.req.param("id"));
  return c.json({ data: { ok: true } });
});

scoringProfileRoutes.put("/assign/:projectId", async (c) => {
  const { profileId } = await c.req.json<{ profileId: string | null }>();
  const project = await projectQueries(c.get("db")).getById(
    c.req.param("projectId"),
  );
  if (!project || project.userId !== c.get("userId")) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }
  if (profileId) {
    const profile = await scoringProfileQueries(c.get("db")).getById(profileId);
    if (!profile || profile.userId !== c.get("userId")) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Profile not found" } },
        404,
      );
    }
  }
  await projectQueries(c.get("db")).update(c.req.param("projectId"), {
    scoringProfileId: profileId,
  });
  return c.json({
    data: { projectId: c.req.param("projectId"), scoringProfileId: profileId },
  });
});
```

**Step 3: Mount in index.ts**

```typescript
import { scoringProfileRoutes } from "./routes/scoring-profiles";
app.route("/api/scoring-profiles", scoringProfileRoutes);
```

**Step 4: Run typecheck and commit**

Run: `pnpm typecheck`

```bash
git add packages/scoring/src/index.ts packages/db/src/index.ts \
  apps/api/src/routes/scoring-profiles.ts apps/api/src/index.ts
git commit -m "feat(api): add scoring profile CRUD routes with preset support"
```

---

### Task 8: Wire Scoring Profiles into Crawl Pipeline

**Files:**

- Modify: `apps/api/src/services/ingest-service.ts` or `apps/api/src/services/post-processing-service.ts`

**Context:** When a crawl completes, pages are scored. The scoring pipeline needs to load the project's `scoringProfileId`, fetch the profile's weights, and pass to `scorePage(page, customWeights)`. The `scorePage` in `packages/scoring/src/engine.ts:20` already accepts `customWeights?: ScoringWeights`.

**Step 1: Find where scorePage is called in the ingest pipeline**

Search for `scorePage` in `apps/api/src/services/`. Add profile lookup before the scoring loop.

**Step 2: Add profile weight injection**

```typescript
import { scoringProfileQueries, projectQueries } from "@llm-boost/db";
import type { ScoringWeights } from "@llm-boost/scoring";

// Before the scoring loop:
let customWeights: ScoringWeights | undefined;
const project = await projectQueries(db).getById(projectId);
if (project?.scoringProfileId) {
  const profile = await scoringProfileQueries(db).getById(
    project.scoringProfileId,
  );
  if (profile?.weights) {
    customWeights = profile.weights as ScoringWeights;
  }
}

// Pass to scorePage:
const result = scorePage(pageData, customWeights);
```

**Step 3: Run tests and typecheck**

Run: `pnpm test && pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/api/src/services/
git commit -m "feat(api): inject custom scoring weights from project profile into crawl pipeline"
```

---

### Task 9: Scoring Profile UI Component

**Files:**

- Create: `apps/web/src/components/settings/scoring-profile-section.tsx`
- Modify: `apps/web/src/lib/api.ts` (add scoring profile client methods)

**Context:** Project settings needs a "Scoring Profile" section with preset dropdown, 4 sliders summing to 100, and save button.

**Step 1: Add API client methods to api.ts**

```typescript
scoringProfiles: {
  list() {
    return request<{ data: { profiles: any[]; presets: Record<string, any> } }>("/api/scoring-profiles").then(r => r.data);
  },
  create(data: { name: string; weights: any; preset?: string }) {
    return request<{ data: any }>("/api/scoring-profiles", { method: "POST", body: data }).then(r => r.data);
  },
  assignToProject(projectId: string, profileId: string | null) {
    return request(`/api/scoring-profiles/assign/${projectId}`, { method: "PUT", body: { profileId } });
  },
},
```

**Step 2: Create the scoring profile section component**

Create `apps/web/src/components/settings/scoring-profile-section.tsx`. This component takes `projectId` as a prop and renders:

- Preset dropdown (default, ecommerce, blog, saas, local_business)
- 4 range inputs with live values (technical, content, aiReadiness, performance)
- Sum validation display showing current total (must be 100)
- Save button

**Step 3: Run typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/web/src/components/settings/scoring-profile-section.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): add scoring profile UI with presets and custom weight sliders"
```

---

## Phase 3: Bulk Export + WordPress Plugin

### Task 10: CSV/JSON Export Route

**Files:**

- Create: `apps/api/src/routes/exports.ts`
- Modify: `apps/api/src/index.ts` (mount route)

**Step 1: Create export route**

Create `apps/api/src/routes/exports.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import { crawlQueries, scoreQueries } from "@llm-boost/db";

export const exportRoutes = new Hono<AppEnv>();
exportRoutes.use("*", authMiddleware);

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getLetterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

exportRoutes.get("/:projectId/export", withOwnership("project"), async (c) => {
  const db = c.get("db");
  const project = c.get("project");
  const format = c.req.query("format") ?? "csv";

  const latestCrawl = await crawlQueries(db).getLatestByProject(project.id);
  if (!latestCrawl) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "No completed crawl found" } },
      404,
    );
  }

  const pagesWithScores = await scoreQueries(db).listByJobWithPages(
    latestCrawl.id,
  );

  const rows = pagesWithScores.map((p) => ({
    url: p.page?.url ?? "",
    overallScore: p.overallScore ?? 0,
    technicalScore: p.technicalScore ?? 0,
    contentScore: p.contentScore ?? 0,
    aiReadinessScore: p.aiReadinessScore ?? 0,
    performanceScore: p.performanceScore ?? 0,
    letterGrade: getLetterGrade(p.overallScore ?? 0),
    issueCount: p.issueCount ?? 0,
  }));

  if (format === "json") {
    return c.json({ data: rows }, 200, {
      "Content-Disposition": `attachment; filename="${project.domain}-export.json"`,
    });
  }

  const headers = [
    "URL",
    "Overall Score",
    "Technical",
    "Content",
    "AI Readiness",
    "Performance",
    "Grade",
    "Issues",
  ];
  const csvLines = [headers.join(",")];
  for (const row of rows) {
    csvLines.push(
      [
        escapeCsv(row.url),
        row.overallScore,
        row.technicalScore,
        row.contentScore,
        row.aiReadinessScore,
        row.performanceScore,
        row.letterGrade,
        row.issueCount,
      ].join(","),
    );
  }

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.domain}-export.csv"`,
    },
  });
});
```

**Step 2: Mount in index.ts**

```typescript
import { exportRoutes } from "./routes/exports";
app.route("/api/projects", exportRoutes);
```

**Step 3: Run typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/api/src/routes/exports.ts apps/api/src/index.ts
git commit -m "feat(api): add CSV/JSON export endpoint for project crawl data"
```

---

### Task 11: Export Button in Frontend

**Files:**

- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx`

**Step 1: Add export helper to api.ts**

```typescript
exports: {
  download(projectId: string, format: "csv" | "json") {
    window.open(`${API_BASE_URL}/api/projects/${projectId}/export?format=${format}`, "_blank");
  },
},
```

**Step 2: Add export dropdown to overview tab**

Add a `DropdownMenu` with "Export CSV" and "Export JSON" items near the top of the overview tab, next to existing action buttons.

**Step 3: Run typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/tabs/overview-tab.tsx
git commit -m "feat(web): add export CSV/JSON dropdown to project overview"
```

---

### Task 12: Lightweight Scoring Endpoint for WordPress

**Files:**

- Modify: `apps/api/src/routes/v1.ts`

**Context:** v1 routes use API token auth. Add `POST /api/v1/score` that accepts content and runs the scoring engine without a crawl. The `scorePage` function needs a `PageData` object.

**Step 1: Add score endpoint to v1.ts**

```typescript
import { scorePage } from "@llm-boost/scoring";

v1Routes.post("/score", async (c) => {
  const { title, content, url, metaDescription } = await c.req.json<{
    title: string;
    content: string;
    url: string;
    metaDescription?: string;
  }>();

  // Build synthetic PageData from raw content
  const pageData = {
    url,
    statusCode: 200,
    title: title ?? "",
    metaDescription: metaDescription ?? "",
    contentText: content ?? "",
    headings: extractHeadings(content),
    wordCount: (content ?? "").split(/\\s+/).length,
    hasStructuredData: content.includes("application/ld+json"),
    hasOpenGraph: content.includes("og:title"),
    hasCanonical: content.includes('rel="canonical"'),
    hasLlmsTxt: false,
    hasFaqSection: content.toLowerCase().includes("faq"),
    robotsMeta: "",
    contentLength: (content ?? "").length,
    lcp: 2000,
    fid: 50,
    cls: 0.05,
    ttfb: 200,
    transferSize: (content ?? "").length,
  };

  const result = scorePage(pageData as any);

  return c.json({
    data: {
      overall: result.overallScore,
      technical: result.technicalScore,
      content: result.contentScore,
      aiReadiness: result.aiReadinessScore,
      performance: result.performanceScore,
      letterGrade: result.letterGrade,
      issues: result.issues.slice(0, 5).map((i) => ({
        code: i.code,
        severity: i.severity,
        message: i.message,
        recommendation: i.recommendation,
      })),
    },
  });
});

function extractHeadings(html: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const regex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(m[1]),
      text: m[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  return headings;
}
```

**Step 2: Check PageData type compatibility**

Read `packages/scoring/src/types.ts` and adjust field names as needed.

**Step 3: Run typecheck and commit**

Run: `pnpm typecheck`

```bash
git add apps/api/src/routes/v1.ts
git commit -m "feat(api): add POST /api/v1/score lightweight scoring endpoint for plugins"
```

---

### Task 13: WordPress Gutenberg Sidebar Panel

**Files:**

- Create: `apps/wordpress-plugin/assets/js/editor-panel.js`
- Create: `apps/wordpress-plugin/assets/css/editor-panel.css`
- Modify: `apps/wordpress-plugin/llm-boost.php`

**Step 1: Register block editor assets in llm-boost.php**

Add to `llm-boost.php`:

```php
add_action('enqueue_block_editor_assets', function () {
    $api_key = get_option('llm_boost_api_key', '');
    $api_url = get_option('llm_boost_api_url', 'https://api.llmboost.com');

    wp_enqueue_script(
        'llm-boost-editor-panel',
        plugins_url('assets/js/editor-panel.js', __FILE__),
        ['wp-plugins', 'wp-edit-post', 'wp-element', 'wp-data', 'wp-components'],
        '1.0.0',
        true
    );

    wp_localize_script('llm-boost-editor-panel', 'llmBoostConfig', [
        'apiKey' => $api_key,
        'apiUrl' => $api_url,
    ]);

    wp_enqueue_style(
        'llm-boost-editor-panel',
        plugins_url('assets/css/editor-panel.css', __FILE__),
        [],
        '1.0.0'
    );
});
```

**Step 2: Create the Gutenberg sidebar panel**

Create `apps/wordpress-plugin/assets/js/editor-panel.js` — a React component using `wp.element` that:

1. Registers via `wp.plugins.registerPlugin` with `PluginSidebar`
2. Watches post content via `wp.data.useSelect('core/editor')`
3. Debounces API calls (5s)
4. Displays score circle, category breakdown, top 3 issues

**Step 3: Create editor panel styles**

Create `apps/wordpress-plugin/assets/css/editor-panel.css`.

**Step 4: Commit**

```bash
git add apps/wordpress-plugin/
git commit -m "feat(wordpress): add Gutenberg sidebar panel for real-time AI readiness scoring"
```

---

## Final Verification

### Task 14: Full Suite Verification

**Step 1: Run all typechecks**

Run: `pnpm typecheck`
Expected: All packages clean

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All existing tests pass

**Step 3: Verify all new routes are mounted**

Check `apps/api/src/index.ts` includes: `/api/orgs`, `/api/scoring-profiles`, branding routes on `/api/projects`, export routes on `/api/projects`, and v1 score endpoint.

**Step 4: Fix any remaining issues and commit**

```bash
git add -A && git commit -m "fix: address typecheck and test issues from agency features bundle"
```
