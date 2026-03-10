import { Loader2, Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationInvite, OrganizationMember } from "@/lib/api";
import {
  formatTeamDate,
  inviteStatusBadgeVariant,
  ORGANIZATION_ROLE_OPTIONS,
  roleBadgeVariant,
  type OrganizationAssignableRole,
} from "./team-section-helpers";

type CreateOrganizationCardProps = {
  orgName: string;
  orgSlug: string;
  creatingOrg: boolean;
  createOrgError: string | null;
  onOrgNameChange: (value: string) => void;
  onOrgSlugChange: (value: string) => void;
  onCreateOrg: () => void | Promise<void>;
};

type TeamMembersCardProps = {
  members: OrganizationMember[];
  updatingMemberId: string | null;
  removingMemberId: string | null;
  onChangeRole: (
    memberId: string,
    newRole: OrganizationAssignableRole,
  ) => void | Promise<void>;
  onRemoveMember: (memberId: string) => void | Promise<void>;
};

type InviteMemberCardProps = {
  inviteEmail: string;
  inviteRole: OrganizationAssignableRole;
  sendingInvite: boolean;
  inviteError: string | null;
  inviteSuccess: boolean;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: OrganizationAssignableRole) => void;
  onSendInvite: () => void | Promise<void>;
};

type PendingInvitesCardProps = {
  invites: OrganizationInvite[];
};

export function TeamSectionLoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Loading team...</span>
    </div>
  );
}

export function CreateOrganizationCard({
  orgName,
  orgSlug,
  creatingOrg,
  createOrgError,
  onOrgNameChange,
  onOrgSlugChange,
  onCreateOrg,
}: CreateOrganizationCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Create Organization</CardTitle>
        </div>
        <CardDescription>
          Create an organization to invite team members and collaborate on
          projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="org-name"
            className="text-sm font-medium leading-none"
          >
            Organization Name
          </label>
          <Input
            id="org-name"
            placeholder="e.g. Acme Inc."
            value={orgName}
            onChange={(event) => onOrgNameChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="org-slug"
            className="text-sm font-medium leading-none"
          >
            Slug
          </label>
          <Input
            id="org-slug"
            placeholder="e.g. acme-inc"
            value={orgSlug}
            onChange={(event) => onOrgSlugChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens only.
          </p>
        </div>
        {createOrgError && (
          <p className="text-sm text-destructive">{createOrgError}</p>
        )}
        <Button onClick={onCreateOrg} disabled={creatingOrg}>
          {creatingOrg ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              Create Organization
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function TeamMembersCard({
  members,
  updatingMemberId,
  removingMemberId,
  onChangeRole,
  onRemoveMember,
}: TeamMembersCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Team Members</CardTitle>
        </div>
        <CardDescription>
          Manage who has access to your organization&apos;s projects and data.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No team members yet. Invite someone below.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">
                        {member.name ?? "Unnamed"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(member.role)}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTeamDate(member.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.role !== "owner" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={member.role}
                          disabled={updatingMemberId === member.id}
                          onValueChange={(value) =>
                            onChangeRole(
                              member.id,
                              value as OrganizationAssignableRole,
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            {updatingMemberId === member.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {ORGANIZATION_ROLE_OPTIONS.map((roleOption) => (
                              <SelectItem
                                key={roleOption.value}
                                value={roleOption.value}
                              >
                                {roleOption.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          aria-label={`Remove ${member.email}`}
                          variant="ghost"
                          size="sm"
                          disabled={removingMemberId === member.id}
                          onClick={() => onRemoveMember(member.id)}
                        >
                          {removingMemberId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        <Shield className="mr-1 inline h-3 w-3" />
                        Owner
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function InviteMemberCard({
  inviteEmail,
  inviteRole,
  sendingInvite,
  inviteError,
  inviteSuccess,
  onInviteEmailChange,
  onInviteRoleChange,
  onSendInvite,
}: InviteMemberCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Invite Team Member</CardTitle>
        </div>
        <CardDescription>
          Send an invitation to a new team member by email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <label
              htmlFor="invite-email"
              className="text-sm font-medium leading-none"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                className="pl-9"
                value={inviteEmail}
                onChange={(event) => onInviteEmailChange(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="invite-role"
              className="text-sm font-medium leading-none"
            >
              Role
            </label>
            <Select
              value={inviteRole}
              onValueChange={(value) =>
                onInviteRoleChange(value as OrganizationAssignableRole)
              }
            >
              <SelectTrigger id="invite-role" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_ROLE_OPTIONS.map((roleOption) => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onSendInvite} disabled={sendingInvite}>
            {sendingInvite ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Send Invite
              </>
            )}
          </Button>
        </div>
        {inviteError && (
          <p className="text-sm text-destructive">{inviteError}</p>
        )}
        {inviteSuccess && (
          <p className="text-sm text-green-600">
            Invitation sent successfully.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PendingInvitesCard({ invites }: PendingInvitesCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Pending Invites</CardTitle>
        </div>
        <CardDescription>
          Invitations that have been sent but not yet accepted.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="text-sm">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(invite.role)}>
                    {invite.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={inviteStatusBadgeVariant(invite.status)}>
                    {invite.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatTeamDate(invite.expiresAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
