"use client";

import {
  CreateOrganizationCard,
  InviteMemberCard,
  PendingInvitesCard,
  TeamMembersCard,
  TeamSectionLoadingState,
} from "./team-section-sections";
import { useTeamSectionState } from "./use-team-section-state";

export function TeamSection() {
  const state = useTeamSectionState();

  if (state.loading) {
    return <TeamSectionLoadingState />;
  }

  if (!state.org) {
    return (
      <div className="space-y-6 pt-4">
        <CreateOrganizationCard
          orgName={state.orgName}
          orgSlug={state.orgSlug}
          creatingOrg={state.creatingOrg}
          createOrgError={state.createOrgError}
          onOrgNameChange={state.handleOrgNameChange}
          onOrgSlugChange={state.handleOrgSlugChange}
          onCreateOrg={state.handleCreateOrg}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <TeamMembersCard
        members={state.members}
        updatingMemberId={state.updatingMemberId}
        removingMemberId={state.removingMemberId}
        onChangeRole={state.handleChangeRole}
        onRemoveMember={state.handleRemoveMember}
      />
      <InviteMemberCard
        inviteEmail={state.inviteEmail}
        inviteRole={state.inviteRole}
        sendingInvite={state.sendingInvite}
        inviteError={state.inviteError}
        inviteSuccess={state.inviteSuccess}
        onInviteEmailChange={state.handleInviteEmailChange}
        onInviteRoleChange={state.handleInviteRoleChange}
        onSendInvite={state.handleSendInvite}
      />
      {state.invites.length > 0 && (
        <PendingInvitesCard invites={state.invites} />
      )}
    </div>
  );
}
