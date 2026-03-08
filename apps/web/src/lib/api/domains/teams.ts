import type { Team, TeamDetail } from "../types/organizations";
import type { OrganizationsApi } from "./organizations";

type TeamInviteInput = {
  email: string;
  role?: string;
};

const toLegacyTeam = (org: {
  id: string;
  name: string;
  createdAt: string;
}): Team => ({
  id: org.id,
  name: org.name,
  ownerId: "",
  plan: "",
  role: "owner",
  createdAt: org.createdAt,
});

const toOrganizationRole = (role?: string): "admin" | "member" | "viewer" => {
  if (role === "admin" || role === "viewer") {
    return role;
  }

  return "member";
};

const createOrganizationSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

export function createTeamsApi(organizationsApi: OrganizationsApi) {
  return {
    async list(): Promise<Team[]> {
      const org = await organizationsApi.getCurrent();
      if (!org) {
        return [];
      }

      return [toLegacyTeam(org)];
    },

    async create(name: string): Promise<Team> {
      const org = await organizationsApi.create({
        name,
        slug: createOrganizationSlug(name),
      });

      return toLegacyTeam(org);
    },

    async getById(id: string): Promise<TeamDetail> {
      const [org, members] = await Promise.all([
        organizationsApi.getById(id),
        organizationsApi.listMembers(id),
      ]);

      return {
        ...toLegacyTeam(org),
        members: members.map((member) => ({
          id: member.id,
          teamId: org.id,
          userId: member.userId,
          name: member.name,
          email: member.email,
          role: member.role === "member" ? "editor" : member.role,
          joinedAt: member.joinedAt,
        })),
      };
    },

    async invite(teamId: string, data: TeamInviteInput): Promise<unknown> {
      return organizationsApi.invite(teamId, {
        email: data.email,
        role: toOrganizationRole(data.role),
      });
    },

    async acceptInvite(token: string): Promise<unknown> {
      return organizationsApi.acceptInvite(token);
    },

    async updateRole(
      teamId: string,
      memberId: string,
      role: string,
    ): Promise<unknown> {
      return organizationsApi.updateMemberRole(
        teamId,
        memberId,
        toOrganizationRole(role),
      );
    },

    async removeMember(teamId: string, memberId: string): Promise<void> {
      await organizationsApi.removeMember(teamId, memberId);
    },
  };
}
