import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useTeamSectionState } from "./use-team-section-state";

const org = {
  id: "org-1",
  name: "Acme Inc.",
  slug: "acme-inc",
  createdAt: "2026-03-07T12:00:00.000Z",
};

const member = {
  id: "member-1",
  userId: "user-1",
  name: "Taylor",
  email: "taylor@example.com",
  role: "member" as const,
  joinedAt: "2026-03-07T12:00:00.000Z",
};

const invite = {
  id: "invite-1",
  email: "pending@example.com",
  role: "viewer" as const,
  status: "pending" as const,
  expiresAt: "2026-03-15T12:00:00.000Z",
  createdAt: "2026-03-07T12:00:00.000Z",
};

describe("useTeamSectionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.organizations.getCurrent = vi.fn(async () => null);
    api.organizations.listMembers = vi.fn(async () => []);
    api.organizations.listInvites = vi.fn(async () => []);
    api.organizations.create = vi.fn(async () => org);
    api.organizations.invite = vi.fn(async () => invite);
    api.organizations.updateMemberRole = vi.fn(async () => ({
      ...member,
      role: "admin" as const,
    }));
    api.organizations.removeMember = vi.fn(async () => undefined);
  });

  it("loads an existing organization with members and invites", async () => {
    api.organizations.getCurrent = vi.fn(async () => org);
    api.organizations.listMembers = vi.fn(async () => [member]);
    api.organizations.listInvites = vi.fn(async () => [invite]);

    const { result } = renderHook(() => useTeamSectionState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.org?.id).toBe("org-1");
      expect(result.current.members).toHaveLength(1);
      expect(result.current.invites).toHaveLength(1);
    });

    expect(api.organizations.listMembers).toHaveBeenCalledWith("org-1");
    expect(api.organizations.listInvites).toHaveBeenCalledWith("org-1");
  });

  it("validates and creates an organization", async () => {
    const { result } = renderHook(() => useTeamSectionState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCreateOrg();
    });

    expect(result.current.createOrgError).toBe(
      "Organization name is required.",
    );

    act(() => {
      result.current.handleOrgNameChange("Acme Inc.");
    });

    expect(result.current.orgSlug).toBe("acme-inc");

    await act(async () => {
      await result.current.handleCreateOrg();
    });

    expect(api.organizations.create).toHaveBeenCalledWith({
      name: "Acme Inc.",
      slug: "acme-inc",
    });
    expect(result.current.org?.id).toBe("org-1");
    expect(result.current.members).toEqual([]);
    expect(result.current.invites).toEqual([]);
  });

  it("sends invites, updates roles, and removes members", async () => {
    api.organizations.getCurrent = vi.fn(async () => org);
    api.organizations.listMembers = vi.fn(async () => [member]);
    api.organizations.listInvites = vi.fn(async () => [invite]);
    api.organizations.invite = vi.fn(async () => ({
      id: "invite-2",
      email: "new@example.com",
      role: "admin" as const,
      status: "pending" as const,
      expiresAt: "2026-03-20T12:00:00.000Z",
      createdAt: "2026-03-07T12:00:00.000Z",
    }));

    const { result } = renderHook(() => useTeamSectionState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.members).toHaveLength(1);
      expect(result.current.invites).toHaveLength(1);
    });

    act(() => {
      result.current.handleInviteEmailChange("new@example.com");
      result.current.handleInviteRoleChange("admin");
    });

    await act(async () => {
      await result.current.handleSendInvite();
    });

    expect(api.organizations.invite).toHaveBeenCalledWith("org-1", {
      email: "new@example.com",
      role: "admin",
    });
    expect(result.current.invites).toHaveLength(2);
    expect(result.current.inviteSuccess).toBe(true);
    expect(result.current.inviteEmail).toBe("");
    expect(result.current.inviteRole).toBe("member");

    await act(async () => {
      await result.current.handleChangeRole("member-1", "admin");
    });

    expect(api.organizations.updateMemberRole).toHaveBeenCalledWith(
      "org-1",
      "member-1",
      "admin",
    );
    expect(result.current.members[0]?.role).toBe("admin");

    await act(async () => {
      await result.current.handleRemoveMember("member-1");
    });

    expect(api.organizations.removeMember).toHaveBeenCalledWith(
      "org-1",
      "member-1",
    );
    expect(result.current.members).toEqual([]);
  });
});
