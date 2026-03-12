export const OrgRole = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const TeamRole = {
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

export const Permission = {
  PROJECT_CREATE: "project.create",
  PROJECT_READ: "project.read",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",
  CRAWL_START: "crawl.start",
  CRAWL_READ: "crawl.read",
  FIX_GENERATE: "fix.generate",
  FIX_APPLY: "fix.apply",
  MEMBER_INVITE: "member.invite",
  MEMBER_REMOVE: "member.remove",
  MEMBER_ROLE_CHANGE: "member.role_change",
  BILLING_MANAGE: "billing.manage",
  SETTINGS_UPDATE: "settings.update",
  SSO_MANAGE: "sso.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const PERMISSION_MATRIX: Record<OrgRole, Set<Permission>> = {
  owner: new Set([
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.CRAWL_START,
    Permission.CRAWL_READ,
    Permission.FIX_GENERATE,
    Permission.FIX_APPLY,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
    Permission.MEMBER_ROLE_CHANGE,
    Permission.BILLING_MANAGE,
    Permission.SETTINGS_UPDATE,
    Permission.SSO_MANAGE,
    Permission.AUDIT_VIEW,
  ]),
  admin: new Set([
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.CRAWL_START,
    Permission.CRAWL_READ,
    Permission.FIX_GENERATE,
    Permission.FIX_APPLY,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
    Permission.MEMBER_ROLE_CHANGE,
    Permission.SETTINGS_UPDATE,
    Permission.AUDIT_VIEW,
  ]),
  member: new Set([
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.CRAWL_START,
    Permission.CRAWL_READ,
    Permission.FIX_GENERATE,
    Permission.FIX_APPLY,
  ]),
  viewer: new Set([Permission.PROJECT_READ, Permission.CRAWL_READ]),
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.has(permission) ?? false;
}

export function getPermissions(role: OrgRole): Permission[] {
  return [...(PERMISSION_MATRIX[role] ?? [])];
}

// Team Permission Matrix
const TEAM_PERMISSION_MATRIX: Record<TeamRole, Set<Permission>> = {
  owner: new Set([
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.CRAWL_START,
    Permission.CRAWL_READ,
    Permission.FIX_GENERATE,
    Permission.FIX_APPLY,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
    Permission.MEMBER_ROLE_CHANGE,
    Permission.SETTINGS_UPDATE,
  ]),
  admin: new Set([
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.CRAWL_START,
    Permission.CRAWL_READ,
    Permission.FIX_GENERATE,
    Permission.FIX_APPLY,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
    Permission.SETTINGS_UPDATE,
  ]),
  editor: new Set([
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.CRAWL_START,
    Permission.CRAWL_READ,
    Permission.FIX_GENERATE,
    Permission.FIX_APPLY,
  ]),
  viewer: new Set([Permission.PROJECT_READ, Permission.CRAWL_READ]),
};

export function hasTeamPermission(
  role: TeamRole,
  permission: Permission,
): boolean {
  return TEAM_PERMISSION_MATRIX[role]?.has(permission) ?? false;
}

export function getTeamPermissions(role: TeamRole): Permission[] {
  return [...(TEAM_PERMISSION_MATRIX[role] ?? [])];
}

// Resource-level permission checking
export type ResourceType = "project" | "crawl" | "organization" | "team";

export interface AccessContext {
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  permission: Permission;
}
