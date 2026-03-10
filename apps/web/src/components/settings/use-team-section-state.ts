import { useEffect, useState } from "react";
import {
  api,
  type Organization,
  type OrganizationInvite,
  type OrganizationMember,
} from "@/lib/api";
import {
  buildOrganizationSlug,
  resolveTeamErrorMessage,
  type OrganizationAssignableRole,
  validateInviteEmail,
  validateOrganizationForm,
} from "./team-section-helpers";

export function useTeamSectionState() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<OrganizationAssignableRole>("member");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrg() {
      setLoading(true);

      try {
        const currentOrg = await api.organizations.getCurrent();
        if (!active) {
          return;
        }

        if (currentOrg) {
          setOrg(currentOrg);

          const [membersRes, invitesRes] = await Promise.all([
            api.organizations.listMembers(currentOrg.id),
            api.organizations.listInvites(currentOrg.id),
          ]);

          if (!active) {
            return;
          }

          setMembers(membersRes);
          setInvites(invitesRes);
        }
      } catch {
        // No org found or request failed — show create form.
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOrg();

    return () => {
      active = false;
    };
  }, []);

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    setOrgSlug(buildOrganizationSlug(value));
    setCreateOrgError(null);
  }

  function handleOrgSlugChange(value: string) {
    setOrgSlug(value);
    setCreateOrgError(null);
  }

  async function handleCreateOrg() {
    setCreateOrgError(null);

    const validationError = validateOrganizationForm(orgName, orgSlug);
    if (validationError) {
      setCreateOrgError(validationError);
      return;
    }

    setCreatingOrg(true);

    try {
      const createdOrg = await api.organizations.create({
        name: orgName.trim(),
        slug: orgSlug.trim(),
      });
      setOrg(createdOrg);
      setMembers([]);
      setInvites([]);
    } catch (error) {
      setCreateOrgError(
        resolveTeamErrorMessage(error, "Failed to create organization"),
      );
    } finally {
      setCreatingOrg(false);
    }
  }

  function handleInviteEmailChange(value: string) {
    setInviteEmail(value);
    setInviteError(null);
    setInviteSuccess(false);
  }

  function handleInviteRoleChange(value: OrganizationAssignableRole) {
    setInviteRole(value);
  }

  async function handleSendInvite() {
    setInviteError(null);
    setInviteSuccess(false);

    const validationError = validateInviteEmail(inviteEmail);
    if (validationError) {
      setInviteError(validationError);
      return;
    }

    if (!org) {
      return;
    }

    setSendingInvite(true);

    try {
      const invite = await api.organizations.invite(org.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInvites((currentInvites) => [...currentInvites, invite]);
      setInviteEmail("");
      setInviteRole("member");
      setInviteSuccess(true);
    } catch (error) {
      setInviteError(resolveTeamErrorMessage(error, "Failed to send invite"));
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleChangeRole(
    memberId: string,
    newRole: OrganizationAssignableRole,
  ) {
    if (!org) {
      return;
    }

    setUpdatingMemberId(memberId);

    try {
      await api.organizations.updateMemberRole(org.id, memberId, newRole);
      setMembers((currentMembers) =>
        currentMembers.map((member) =>
          member.id === memberId ? { ...member, role: newRole } : member,
        ),
      );
    } catch (error) {
      console.error("Failed to change role:", error);
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!org) {
      return;
    }

    setRemovingMemberId(memberId);

    try {
      await api.organizations.removeMember(org.id, memberId);
      setMembers((currentMembers) =>
        currentMembers.filter((member) => member.id !== memberId),
      );
    } catch (error) {
      console.error("Failed to remove member:", error);
    } finally {
      setRemovingMemberId(null);
    }
  }

  return {
    org,
    members,
    invites,
    loading,
    orgName,
    orgSlug,
    creatingOrg,
    createOrgError,
    inviteEmail,
    inviteRole,
    sendingInvite,
    inviteError,
    inviteSuccess,
    updatingMemberId,
    removingMemberId,
    handleOrgNameChange,
    handleOrgSlugChange,
    handleCreateOrg,
    handleInviteEmailChange,
    handleInviteRoleChange,
    handleSendInvite,
    handleChangeRole,
    handleRemoveMember,
  };
}
