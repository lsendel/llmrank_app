import type { Database } from "@llm-boost/db";
import {
  organizationQueries,
  orgMemberQueries,
  orgInviteQueries,
} from "@llm-boost/db";
import {
  hasPermission,
  type OrgRole,
  type Permission,
} from "@llm-boost/shared";
import { ServiceError } from "./errors";
import { logAudit } from "../lib/audit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createOrganizationService(db: Database) {
  const orgs = organizationQueries(db);
  const members = orgMemberQueries(db);
  const invites = orgInviteQueries(db);

  // -- Internal helpers -----------------------------------------------------

  async function requireRole(orgId: string, userId: string) {
    const membership = await members.getMembership(orgId, userId);
    if (!membership) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        "Not a member of this organization",
      );
    }
    return membership;
  }

  async function requirePermission(
    orgId: string,
    userId: string,
    permission: Permission,
  ) {
    const membership = await requireRole(orgId, userId);
    if (!hasPermission(membership.role as OrgRole, permission)) {
      throw new ServiceError(
        "FORBIDDEN",
        403,
        `Missing permission: ${permission}`,
      );
    }
    return membership;
  }

  // -- Public API -----------------------------------------------------------

  return {
    /**
     * Create a new organization. The calling user becomes the owner.
     */
    async create(userId: string, data: { name: string; slug: string }) {
      const existing = await orgs.getBySlug(data.slug);
      if (existing) {
        throw new ServiceError(
          "SLUG_TAKEN",
          409,
          "An organization with this slug already exists",
        );
      }

      const org = await orgs.create({ name: data.name, slug: data.slug });

      await members.add({ orgId: org.id, userId, role: "owner" });

      await logAudit(db, {
        orgId: org.id,
        actorId: userId,
        action: "org.created",
        resourceType: "organization",
        resourceId: org.id,
        metadata: { name: data.name, slug: data.slug },
      });

      return org;
    },

    /**
     * Get the first organization the user belongs to (or null).
     */
    async getForUser(userId: string) {
      const rows = await orgs.listByUser(userId);
      if (rows.length === 0) return null;
      return {
        ...rows[0].org,
        role: rows[0].membership.role,
      };
    },

    /**
     * Get an organization by ID (requires membership).
     */
    async getById(orgId: string, userId: string) {
      await requireRole(orgId, userId);
      const org = await orgs.getById(orgId);
      if (!org) {
        throw new ServiceError("NOT_FOUND", 404, "Organization not found");
      }
      return org;
    },

    /**
     * List all members of an organization (requires membership).
     */
    async listMembers(orgId: string, userId: string) {
      await requireRole(orgId, userId);
      return members.listByOrg(orgId);
    },

    /**
     * Invite a new member by email. Requires MEMBER_INVITE permission.
     */
    async inviteMember(
      orgId: string,
      actorId: string,
      data: { email: string; role: OrgRole },
    ) {
      await requirePermission(orgId, actorId, "member.invite" as Permission);

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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
        action: "member.invited",
        resourceType: "invite",
        resourceId: invite.id,
        metadata: { email: data.email, role: data.role },
      });

      return invite;
    },

    /**
     * Accept an invite token. Adds the user as a member.
     */
    async acceptInvite(token: string, userId: string) {
      const invite = await invites.getByToken(token);
      if (!invite) {
        throw new ServiceError("NOT_FOUND", 404, "Invite not found");
      }

      if (invite.acceptedAt) {
        throw new ServiceError(
          "INVITE_ALREADY_ACCEPTED",
          409,
          "This invite has already been accepted",
        );
      }

      if (invite.expiresAt < new Date()) {
        throw new ServiceError(
          "INVITE_EXPIRED",
          410,
          "This invite has expired",
        );
      }

      await members.add({
        orgId: invite.orgId,
        userId,
        role: (invite.role as OrgRole) ?? "member",
        invitedBy: invite.invitedBy ?? undefined,
      });

      await invites.markAccepted(invite.id);

      await logAudit(db, {
        orgId: invite.orgId,
        actorId: userId,
        action: "member.joined",
        resourceType: "invite",
        resourceId: invite.id,
        metadata: { email: invite.email, role: invite.role },
      });

      return { orgId: invite.orgId };
    },

    /**
     * List all invites for an organization. Requires MEMBER_INVITE permission.
     * Returns invites enriched with a computed `status` field.
     */
    async listInvites(orgId: string, userId: string) {
      await requirePermission(orgId, userId, "member.invite" as Permission);

      const rows = await invites.listByOrg(orgId);
      const now = new Date();

      return rows.map((invite) => {
        let status: "accepted" | "expired" | "pending";
        if (invite.acceptedAt) {
          status = "accepted";
        } else if (invite.expiresAt < now) {
          status = "expired";
        } else {
          status = "pending";
        }
        return { ...invite, status };
      });
    },

    /**
     * Change a member's role. Requires MEMBER_ROLE_CHANGE permission.
     */
    async changeMemberRole(
      orgId: string,
      actorId: string,
      memberId: string,
      newRole: OrgRole,
    ) {
      await requirePermission(
        orgId,
        actorId,
        "member.role_change" as Permission,
      );

      const target = await members.getMembership(orgId, memberId);
      if (!target) {
        throw new ServiceError("NOT_FOUND", 404, "Member not found");
      }

      const updated = await members.updateRole(orgId, memberId, newRole);

      await logAudit(db, {
        orgId,
        actorId,
        action: "member.role_changed",
        resourceType: "member",
        resourceId: memberId,
        metadata: { previousRole: target.role, newRole },
      });

      return updated;
    },

    /**
     * Remove a member from the organization. Requires MEMBER_REMOVE permission.
     */
    async removeMember(orgId: string, actorId: string, memberId: string) {
      await requirePermission(orgId, actorId, "member.remove" as Permission);

      const target = await members.getMembership(orgId, memberId);
      if (!target) {
        throw new ServiceError("NOT_FOUND", 404, "Member not found");
      }

      if (target.role === "owner") {
        throw new ServiceError(
          "FORBIDDEN",
          403,
          "Cannot remove the organization owner",
        );
      }

      await members.remove(orgId, memberId);

      await logAudit(db, {
        orgId,
        actorId,
        action: "member.removed",
        resourceType: "member",
        resourceId: memberId,
        metadata: { role: target.role },
      });

      return { removed: true };
    },
  };
}
