import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CreateOrganizationCard,
  InviteMemberCard,
  PendingInvitesCard,
  TeamMembersCard,
  TeamSectionLoadingState,
} from "./team-section-sections";

describe("team section sections", () => {
  it("renders loading and create-organization states", () => {
    const onOrgNameChange = vi.fn();
    const onOrgSlugChange = vi.fn();
    const onCreateOrg = vi.fn();

    render(
      <>
        <TeamSectionLoadingState />
        <CreateOrganizationCard
          orgName="Acme Inc."
          orgSlug="acme-inc"
          creatingOrg={false}
          createOrgError={null}
          onOrgNameChange={onOrgNameChange}
          onOrgSlugChange={onOrgSlugChange}
          onCreateOrg={onCreateOrg}
        />
      </>,
    );

    expect(screen.getByText("Loading team...")).toBeInTheDocument();
    expect(
      screen.getByText(/Create an organization to invite team members/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Organization Name"), {
      target: { value: "Acme Labs" },
    });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: { value: "acme-labs" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create Organization" }),
    );

    expect(onOrgNameChange).toHaveBeenCalledWith("Acme Labs");
    expect(onOrgSlugChange).toHaveBeenCalledWith("acme-labs");
    expect(onCreateOrg).toHaveBeenCalledTimes(1);
  });

  it("renders member, invite, and pending-invite cards", () => {
    const onInviteEmailChange = vi.fn();
    const onInviteRoleChange = vi.fn();
    const onSendInvite = vi.fn();
    const onChangeRole = vi.fn();
    const onRemoveMember = vi.fn();

    render(
      <>
        <TeamMembersCard
          members={[
            {
              id: "owner-1",
              userId: "user-owner",
              name: "Alex",
              email: "alex@example.com",
              role: "owner",
              joinedAt: "2026-03-07T12:00:00.000Z",
            },
            {
              id: "member-1",
              userId: "user-member",
              name: "Taylor",
              email: "taylor@example.com",
              role: "member",
              joinedAt: "2026-03-08T12:00:00.000Z",
            },
          ]}
          updatingMemberId={null}
          removingMemberId={null}
          onChangeRole={onChangeRole}
          onRemoveMember={onRemoveMember}
        />
        <InviteMemberCard
          inviteEmail="pending@example.com"
          inviteRole="member"
          sendingInvite={false}
          inviteError={null}
          inviteSuccess
          onInviteEmailChange={onInviteEmailChange}
          onInviteRoleChange={onInviteRoleChange}
          onSendInvite={onSendInvite}
        />
        <PendingInvitesCard
          invites={[
            {
              id: "invite-1",
              email: "pending@example.com",
              role: "viewer",
              status: "pending",
              expiresAt: "2026-03-15T12:00:00.000Z",
              createdAt: "2026-03-07T12:00:00.000Z",
            },
          ]}
        />
      </>,
    );

    expect(screen.getByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("Invite Team Member")).toBeInTheDocument();
    expect(screen.getByText("Pending Invites")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(
      screen.getByText("Invitation sent successfully."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("pending@example.com")).toBeInTheDocument();
    expect(screen.getByText("pending@example.com")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Remove taylor@example.com" }),
    );

    expect(onInviteEmailChange).toHaveBeenCalledWith("new@example.com");
    expect(onSendInvite).toHaveBeenCalledTimes(1);
    expect(onRemoveMember).toHaveBeenCalledWith("member-1");
  });
});
