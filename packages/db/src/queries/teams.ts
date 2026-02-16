import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../client";
import { teams, teamMembers, teamInvitations } from "../schema";
import { randomUUID } from "node:crypto";

export function teamQueries(db: Database) {
  return {
    async create(data: {
      name: string;
      ownerId: string;
      plan?: "free" | "starter" | "pro" | "agency";
    }) {
      const [team] = await db.insert(teams).values(data).returning();
      // Auto-add owner as member
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: data.ownerId,
        role: "owner",
      });
      return team;
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, id))
        .limit(1);
      return row ?? null;
    },

    async listByUser(userId: string) {
      return db
        .select({ team: teams, membership: teamMembers })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId))
        .orderBy(desc(teams.createdAt));
    },

    async listMembers(teamId: string) {
      return db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(desc(teamMembers.joinedAt));
    },

    async addMember(
      teamId: string,
      userId: string,
      role: "admin" | "editor" | "viewer" = "viewer",
    ) {
      const [row] = await db
        .insert(teamMembers)
        .values({ teamId, userId, role })
        .returning();
      return row;
    },

    async removeMember(teamId: string, userId: string) {
      await db
        .delete(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        );
    },

    async updateMemberRole(
      teamId: string,
      userId: string,
      role: "admin" | "editor" | "viewer",
    ) {
      const [row] = await db
        .update(teamMembers)
        .set({ role })
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .returning();
      return row;
    },

    async getMembership(teamId: string, userId: string) {
      const [row] = await db
        .select()
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1);
      return row ?? null;
    },

    async createInvitation(
      teamId: string,
      email: string,
      role: "admin" | "editor" | "viewer" = "viewer",
    ) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const [row] = await db
        .insert(teamInvitations)
        .values({ teamId, email, role, token, expiresAt })
        .returning();
      return row;
    },

    async getInvitationByToken(token: string) {
      const [row] = await db
        .select()
        .from(teamInvitations)
        .where(eq(teamInvitations.token, token))
        .limit(1);
      return row ?? null;
    },

    async deleteInvitation(id: string) {
      await db.delete(teamInvitations).where(eq(teamInvitations.id, id));
    },
  };
}
