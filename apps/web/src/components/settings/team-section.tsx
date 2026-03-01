"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Shield, Trash2, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  ApiError,
  type Organization,
  type OrganizationInvite,
  type OrganizationMember,
} from "@/lib/api";

// ─── Role badge colors ──────────────────────────────────────────────

function roleBadgeVariant(
  role: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "destructive";
    case "member":
      return "secondary";
    default:
      return "outline";
  }
}

// ─── Component ──────────────────────────────────────────────────────

export function TeamSection() {
  // Organization state
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Create org form
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Member actions
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // ── Load organization data ──────────────────────────────────────

  useEffect(() => {
    async function loadOrg() {
      setLoading(true);
      try {
        const currentOrg = await api.organizations.getCurrent();
        if (currentOrg) {
          setOrg(currentOrg);
          // Load members and invites in parallel
          const [membersRes, invitesRes] = await Promise.all([
            api.organizations.listMembers(currentOrg.id),
            api.organizations.listInvites(currentOrg.id),
          ]);
          setMembers(membersRes);
          setInvites(invitesRes);
        }
      } catch {
        // No org found or request failed — show create form
      } finally {
        setLoading(false);
      }
    }
    loadOrg();
  }, []);

  // ── Create organization ─────────────────────────────────────────

  async function handleCreateOrg() {
    setCreateOrgError(null);
    if (!orgName.trim()) {
      setCreateOrgError("Organization name is required.");
      return;
    }
    if (!orgSlug.trim()) {
      setCreateOrgError("Organization slug is required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(orgSlug)) {
      setCreateOrgError(
        "Slug must only contain lowercase letters, numbers, and hyphens.",
      );
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
    } catch (err) {
      setCreateOrgError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create organization",
      );
    } finally {
      setCreatingOrg(false);
    }
  }

  // ── Invite member ───────────────────────────────────────────────

  async function handleSendInvite() {
    setInviteError(null);
    setInviteSuccess(false);
    if (!inviteEmail.trim()) {
      setInviteError("Email address is required.");
      return;
    }
    if (!org) return;

    setSendingInvite(true);
    try {
      const invite = await api.organizations.invite(org.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInvites((prev) => [...prev, invite]);
      setInviteEmail("");
      setInviteRole("member");
      setInviteSuccess(true);
    } catch (err) {
      setInviteError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to send invite",
      );
    } finally {
      setSendingInvite(false);
    }
  }

  // ── Change member role ──────────────────────────────────────────

  async function handleChangeRole(memberId: string, newRole: string) {
    if (!org) return;
    setUpdatingMemberId(memberId);
    try {
      await api.organizations.updateMemberRole(
        org.id,
        memberId,
        newRole as "admin" | "member" | "viewer",
      );
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, role: newRole as OrganizationMember["role"] }
            : m,
        ),
      );
    } catch (err) {
      console.error("Failed to change role:", err);
    } finally {
      setUpdatingMemberId(null);
    }
  }

  // ── Remove member ───────────────────────────────────────────────

  async function handleRemoveMember(memberId: string) {
    if (!org) return;
    setRemovingMemberId(memberId);
    try {
      await api.organizations.removeMember(org.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setRemovingMemberId(null);
    }
  }

  // ── Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading team...</span>
      </div>
    );
  }

  // ── Create Organization ─────────────────────────────────────────

  if (!org) {
    return (
      <div className="space-y-6 pt-4">
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
                onChange={(e) => {
                  setOrgName(e.target.value);
                  setCreateOrgError(null);
                  // Auto-generate slug from name
                  const slug = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");
                  setOrgSlug(slug);
                }}
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
                onChange={(e) => {
                  setOrgSlug(e.target.value);
                  setCreateOrgError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            {createOrgError && (
              <p className="text-sm text-destructive">{createOrgError}</p>
            )}
            <Button onClick={handleCreateOrg} disabled={creatingOrg}>
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
      </div>
    );
  }

  // ── Organization exists — show team management ──────────────────

  return (
    <div className="space-y-6 pt-4">
      {/* Members Table */}
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
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== "owner" && (
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={member.role}
                            disabled={updatingMemberId === member.id}
                            onValueChange={(value) =>
                              handleChangeRole(member.id, value)
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
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removingMemberId === member.id}
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            {removingMemberId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      )}
                      {member.role === "owner" && (
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

      {/* Invite Form */}
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
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError(null);
                    setInviteSuccess(false);
                  }}
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
                onValueChange={(v) =>
                  setInviteRole(v as "admin" | "member" | "viewer")
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSendInvite} disabled={sendingInvite}>
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

      {/* Pending Invites */}
      {invites.length > 0 && (
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
                      <Badge
                        variant={
                          invite.status === "pending"
                            ? "outline"
                            : invite.status === "accepted"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
