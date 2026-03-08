import { apiClient } from "../core/client";
import type { ApiEnvelope } from "../core/types";
import type {
  Organization,
  OrganizationInvite,
  OrganizationMember,
} from "../types/organizations";

type OrganizationRole = "admin" | "member" | "viewer";

type CreateOrganizationInput = {
  name: string;
  slug: string;
};

type InviteOrganizationMemberInput = {
  email: string;
  role?: OrganizationRole;
};

export function createOrganizationsApi() {
  return {
    async getCurrent(): Promise<Organization | null> {
      const res =
        await apiClient.get<ApiEnvelope<Organization | null>>("/api/orgs");
      return res.data;
    },

    async create(data: CreateOrganizationInput): Promise<Organization> {
      const res = await apiClient.post<ApiEnvelope<Organization>>(
        "/api/orgs",
        data,
      );
      return res.data;
    },

    async getById(id: string): Promise<Organization> {
      const res = await apiClient.get<ApiEnvelope<Organization>>(
        `/api/orgs/${id}`,
      );
      return res.data;
    },

    async listMembers(orgId: string): Promise<OrganizationMember[]> {
      const res = await apiClient.get<ApiEnvelope<OrganizationMember[]>>(
        `/api/orgs/${orgId}/members`,
      );
      return res.data;
    },

    async invite(
      orgId: string,
      data: InviteOrganizationMemberInput,
    ): Promise<OrganizationInvite> {
      const res = await apiClient.post<ApiEnvelope<OrganizationInvite>>(
        `/api/orgs/${orgId}/invites`,
        {
          email: data.email,
          role: data.role ?? "member",
        },
      );
      return res.data;
    },

    async listInvites(orgId: string): Promise<OrganizationInvite[]> {
      const res = await apiClient.get<ApiEnvelope<OrganizationInvite[]>>(
        `/api/orgs/${orgId}/invites`,
      );
      return res.data;
    },

    async acceptInvite(token: string): Promise<unknown> {
      const res = await apiClient.post<ApiEnvelope<unknown>>(
        "/api/orgs/accept-invite",
        { token },
      );
      return res.data;
    },

    async updateMemberRole(
      orgId: string,
      memberId: string,
      role: OrganizationRole,
    ): Promise<OrganizationMember> {
      const res = await apiClient.patch<ApiEnvelope<OrganizationMember>>(
        `/api/orgs/${orgId}/members/${memberId}`,
        { role },
      );
      return res.data;
    },

    async removeMember(orgId: string, memberId: string): Promise<void> {
      await apiClient.delete(`/api/orgs/${orgId}/members/${memberId}`);
    },
  };
}

export type OrganizationsApi = ReturnType<typeof createOrganizationsApi>;
