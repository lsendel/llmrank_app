import { eq, and, desc, gte, sql, like } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import {
  organizations,
  orgMembers,
  orgInvites,
  auditLogs,
  users,
} from "../schema";
import type { OrgRole } from "../schema/enums";

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

export function organizationQueries(db: Database) {
  return {
    async getById(id: string) {
      const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
      return row ?? null;
    },

    async getBySlug(slug: string) {
      const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      return row ?? null;
    },

    async create(data: {
      name: string;
      slug: string;
      plan?: "free" | "starter" | "pro" | "agency";
    }) {
      const [row] = await db
        .insert(organizations)
        .values({ ...data, id: crypto.randomUUID() })
        .returning();
      return row;
    },

    async update(
      id: string,
      data: {
        name?: string;
        slug?: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        settings?: unknown;
        ssoEnabled?: boolean;
        ssoProvider?: string;
        ssoConfig?: unknown;
      },
    ) {
      const [row] = await db
        .update(organizations)
        .set({
          ...data,
          settings:
            data.settings != null
              ? typeof data.settings === "string"
                ? data.settings
                : JSON.stringify(data.settings)
              : undefined,
          ssoConfig:
            data.ssoConfig != null
              ? typeof data.ssoConfig === "string"
                ? data.ssoConfig
                : JSON.stringify(data.ssoConfig)
              : undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(organizations.id, id))
        .returning();
      return row;
    },

    async delete(id: string) {
      await db.delete(organizations).where(eq(organizations.id, id));
    },

    /** List all organizations a user belongs to. */
    async listByUser(userId: string) {
      return db
        .select({ org: organizations, membership: orgMembers })
        .from(orgMembers)
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        .where(eq(orgMembers.userId, userId))
        .orderBy(desc(organizations.createdAt));
    },
  };
}

// ---------------------------------------------------------------------------
// Organization Members
// ---------------------------------------------------------------------------

export function orgMemberQueries(db: Database) {
  return {
    async add(data: {
      orgId: string;
      userId: string;
      role?: OrgRole;
      invitedBy?: string;
    }) {
      const [row] = await db
        .insert(orgMembers)
        .values({
          id: crypto.randomUUID(),
          orgId: data.orgId,
          userId: data.userId,
          role: data.role ?? "member",
          invitedBy: data.invitedBy ?? null,
          invitedAt: data.invitedBy ? new Date().toISOString() : null,
        })
        .returning();
      return row;
    },

    /** List members with user name/email joined. */
    async listByOrg(orgId: string) {
      return db
        .select({
          id: orgMembers.id,
          orgId: orgMembers.orgId,
          userId: orgMembers.userId,
          role: orgMembers.role,
          invitedBy: orgMembers.invitedBy,
          invitedAt: orgMembers.invitedAt,
          joinedAt: orgMembers.joinedAt,
          name: users.name,
          email: users.email,
        })
        .from(orgMembers)
        .innerJoin(users, eq(orgMembers.userId, users.id))
        .where(eq(orgMembers.orgId, orgId))
        .orderBy(desc(orgMembers.joinedAt));
    },

    async getMembership(orgId: string, userId: string) {
      const [row] = await db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async updateRole(orgId: string, userId: string, role: OrgRole) {
      const [row] = await db
        .update(orgMembers)
        .set({ role })
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .returning();
      return row;
    },

    async remove(orgId: string, userId: string) {
      await db
        .delete(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
    },
  };
}

// ---------------------------------------------------------------------------
// Organization Invites
// ---------------------------------------------------------------------------

export function orgInviteQueries(db: Database) {
  return {
    async create(data: {
      orgId: string;
      email: string;
      role?: OrgRole;
      token: string;
      invitedBy: string;
      expiresAt: Date;
    }) {
      const [row] = await db
        .insert(orgInvites)
        .values({
          ...data,
          id: crypto.randomUUID(),
          expiresAt: data.expiresAt.toISOString(),
        })
        .returning();
      return row;
    },

    async getByToken(token: string) {
      const [row] = await db
        .select()
        .from(orgInvites)
        .where(eq(orgInvites.token, token))
        .limit(1);
      return row ?? null;
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
        .set({ acceptedAt: new Date().toISOString() })
        .where(eq(orgInvites.id, id))
        .returning();
      return row;
    },

    async delete(id: string) {
      await db.delete(orgInvites).where(eq(orgInvites.id, id));
    },
  };
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export function auditLogQueries(db: Database) {
  return {
    async create(data: {
      orgId?: string;
      actorId: string;
      action: string;
      resourceType?: string;
      resourceId?: string;
      metadata?: unknown;
      ipAddress?: string;
      userAgent?: string;
    }) {
      const [row] = await db
        .insert(auditLogs)
        .values({
          ...data,
          id: crypto.randomUUID(),
          metadata:
            data.metadata != null
              ? typeof data.metadata === "string"
                ? data.metadata
                : JSON.stringify(data.metadata)
              : undefined,
        })
        .returning();
      return row;
    },

    /**
     * List audit logs for an organization with filtering and pagination.
     * Returns `{ data, total }` for paginated responses.
     */
    async listByOrg(
      orgId: string,
      opts: {
        limit?: number;
        offset?: number;
        action?: string;
        since?: Date;
      } = {},
    ) {
      const { limit = 50, offset = 0, action, since } = opts;

      // Build conditions array
      const conditions = [eq(auditLogs.orgId, orgId)];
      if (action) conditions.push(like(auditLogs.action, `%${action}%`));
      if (since) conditions.push(gte(auditLogs.createdAt, since.toISOString()));

      const where = and(...conditions);

      const [data, countResult] = await Promise.all([
        db
          .select({
            id: auditLogs.id,
            orgId: auditLogs.orgId,
            actorId: auditLogs.actorId,
            action: auditLogs.action,
            resourceType: auditLogs.resourceType,
            resourceId: auditLogs.resourceId,
            metadata: auditLogs.metadata,
            ipAddress: auditLogs.ipAddress,
            userAgent: auditLogs.userAgent,
            createdAt: auditLogs.createdAt,
            actorName: users.name,
            actorEmail: users.email,
          })
          .from(auditLogs)
          .innerJoin(users, eq(auditLogs.actorId, users.id))
          .where(where)
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(auditLogs)
          .where(where),
      ]);

      return { data, total: countResult[0]?.count ?? 0 };
    },
  };
}
