import { ApiError, type OrganizationInvite } from "@/lib/api";

export type OrganizationAssignableRole = OrganizationInvite["role"];

export const ORGANIZATION_ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
  { label: "Viewer", value: "viewer" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: OrganizationAssignableRole;
}>;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function roleBadgeVariant(role: string): BadgeVariant {
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

export function inviteStatusBadgeVariant(
  status: OrganizationInvite["status"],
): BadgeVariant {
  switch (status) {
    case "pending":
      return "outline";
    case "accepted":
      return "default";
    default:
      return "secondary";
  }
}

export function buildOrganizationSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateOrganizationForm(orgName: string, orgSlug: string) {
  if (!orgName.trim()) {
    return "Organization name is required.";
  }

  if (!orgSlug.trim()) {
    return "Organization slug is required.";
  }

  if (!/^[a-z0-9-]+$/.test(orgSlug)) {
    return "Slug must only contain lowercase letters, numbers, and hyphens.";
  }

  return null;
}

export function validateInviteEmail(inviteEmail: string) {
  if (!inviteEmail.trim()) {
    return "Email address is required.";
  }

  return null;
}

export function formatTeamDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function resolveTeamErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
