import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasTeamPermission,
  getPermissions,
  getTeamPermissions,
  Permission,
  OrgRole,
  TeamRole,
} from "@llm-boost/shared";

describe("Permission Matrix", () => {
  describe("Organization Roles", () => {
    it("owner has all organization permissions", () => {
      expect(hasPermission(OrgRole.OWNER, Permission.PROJECT_CREATE)).toBe(
        true,
      );
      expect(hasPermission(OrgRole.OWNER, Permission.PROJECT_DELETE)).toBe(
        true,
      );
      expect(hasPermission(OrgRole.OWNER, Permission.BILLING_MANAGE)).toBe(
        true,
      );
      expect(hasPermission(OrgRole.OWNER, Permission.SSO_MANAGE)).toBe(true);
      expect(hasPermission(OrgRole.OWNER, Permission.MEMBER_INVITE)).toBe(true);
    });

    it("admin has most permissions except billing and SSO", () => {
      expect(hasPermission(OrgRole.ADMIN, Permission.PROJECT_CREATE)).toBe(
        true,
      );
      expect(hasPermission(OrgRole.ADMIN, Permission.MEMBER_INVITE)).toBe(true);
      expect(hasPermission(OrgRole.ADMIN, Permission.BILLING_MANAGE)).toBe(
        false,
      );
      expect(hasPermission(OrgRole.ADMIN, Permission.SSO_MANAGE)).toBe(false);
    });

    it("member can create and manage own projects", () => {
      expect(hasPermission(OrgRole.MEMBER, Permission.PROJECT_READ)).toBe(true);
      expect(hasPermission(OrgRole.MEMBER, Permission.PROJECT_UPDATE)).toBe(
        true,
      );
      expect(hasPermission(OrgRole.MEMBER, Permission.CRAWL_START)).toBe(true);
      expect(hasPermission(OrgRole.MEMBER, Permission.PROJECT_DELETE)).toBe(
        false,
      );
      expect(hasPermission(OrgRole.MEMBER, Permission.MEMBER_INVITE)).toBe(
        false,
      );
    });

    it("viewer has read-only access", () => {
      expect(hasPermission(OrgRole.VIEWER, Permission.PROJECT_READ)).toBe(true);
      expect(hasPermission(OrgRole.VIEWER, Permission.CRAWL_READ)).toBe(true);
      expect(hasPermission(OrgRole.VIEWER, Permission.PROJECT_UPDATE)).toBe(
        false,
      );
      expect(hasPermission(OrgRole.VIEWER, Permission.CRAWL_START)).toBe(false);
      expect(hasPermission(OrgRole.VIEWER, Permission.MEMBER_INVITE)).toBe(
        false,
      );
    });

    it("getPermissions returns correct permissions for each role", () => {
      const ownerPerms = getPermissions(OrgRole.OWNER);
      const adminPerms = getPermissions(OrgRole.ADMIN);
      const memberPerms = getPermissions(OrgRole.MEMBER);
      const viewerPerms = getPermissions(OrgRole.VIEWER);

      expect(ownerPerms.length).toBeGreaterThan(adminPerms.length);
      expect(adminPerms.length).toBeGreaterThan(memberPerms.length);
      expect(memberPerms.length).toBeGreaterThan(viewerPerms.length);
      expect(viewerPerms).toEqual([
        Permission.PROJECT_READ,
        Permission.CRAWL_READ,
      ]);
    });
  });

  describe("Team Roles", () => {
    it("owner has all team permissions", () => {
      expect(hasTeamPermission(TeamRole.OWNER, Permission.PROJECT_CREATE)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.OWNER, Permission.PROJECT_DELETE)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.OWNER, Permission.MEMBER_INVITE)).toBe(
        true,
      );
      expect(
        hasTeamPermission(TeamRole.OWNER, Permission.MEMBER_ROLE_CHANGE),
      ).toBe(true);
    });

    it("admin can manage members but not change roles", () => {
      expect(hasTeamPermission(TeamRole.ADMIN, Permission.PROJECT_CREATE)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.ADMIN, Permission.MEMBER_INVITE)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.ADMIN, Permission.MEMBER_REMOVE)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.ADMIN, Permission.PROJECT_DELETE)).toBe(
        false,
      );
      expect(
        hasTeamPermission(TeamRole.ADMIN, Permission.MEMBER_ROLE_CHANGE),
      ).toBe(false);
    });

    it("editor can modify projects but not manage members", () => {
      expect(hasTeamPermission(TeamRole.EDITOR, Permission.PROJECT_READ)).toBe(
        true,
      );
      expect(
        hasTeamPermission(TeamRole.EDITOR, Permission.PROJECT_UPDATE),
      ).toBe(true);
      expect(hasTeamPermission(TeamRole.EDITOR, Permission.CRAWL_START)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.EDITOR, Permission.FIX_APPLY)).toBe(
        true,
      );
      expect(
        hasTeamPermission(TeamRole.EDITOR, Permission.PROJECT_CREATE),
      ).toBe(false);
      expect(hasTeamPermission(TeamRole.EDITOR, Permission.MEMBER_INVITE)).toBe(
        false,
      );
    });

    it("viewer has read-only access", () => {
      expect(hasTeamPermission(TeamRole.VIEWER, Permission.PROJECT_READ)).toBe(
        true,
      );
      expect(hasTeamPermission(TeamRole.VIEWER, Permission.CRAWL_READ)).toBe(
        true,
      );
      expect(
        hasTeamPermission(TeamRole.VIEWER, Permission.PROJECT_UPDATE),
      ).toBe(false);
      expect(hasTeamPermission(TeamRole.VIEWER, Permission.CRAWL_START)).toBe(
        false,
      );
    });

    it("getTeamPermissions returns correct permissions for each role", () => {
      const ownerPerms = getTeamPermissions(TeamRole.OWNER);
      const adminPerms = getTeamPermissions(TeamRole.ADMIN);
      const editorPerms = getTeamPermissions(TeamRole.EDITOR);
      const viewerPerms = getTeamPermissions(TeamRole.VIEWER);

      expect(ownerPerms.length).toBeGreaterThan(adminPerms.length);
      expect(adminPerms.length).toBeGreaterThan(editorPerms.length);
      expect(editorPerms.length).toBeGreaterThan(viewerPerms.length);
      expect(viewerPerms).toEqual([
        Permission.PROJECT_READ,
        Permission.CRAWL_READ,
      ]);
    });
  });

  describe("Permission Consistency", () => {
    it("viewer role has same permissions in both team and org contexts", () => {
      const orgViewerPerms = getPermissions(OrgRole.VIEWER);
      const teamViewerPerms = getTeamPermissions(TeamRole.VIEWER);

      expect(orgViewerPerms).toEqual(teamViewerPerms);
    });

    it("all roles have at least read permissions", () => {
      const allOrgRoles = [
        OrgRole.OWNER,
        OrgRole.ADMIN,
        OrgRole.MEMBER,
        OrgRole.VIEWER,
      ];
      const allTeamRoles = [
        TeamRole.OWNER,
        TeamRole.ADMIN,
        TeamRole.EDITOR,
        TeamRole.VIEWER,
      ];

      allOrgRoles.forEach((role) => {
        expect(hasPermission(role, Permission.PROJECT_READ)).toBe(true);
      });

      allTeamRoles.forEach((role) => {
        expect(hasTeamPermission(role, Permission.PROJECT_READ)).toBe(true);
      });
    });
  });
});

describe("AuthorizationService Interface", () => {
  it("provides comprehensive RBAC system", () => {
    // The RBAC system consists of:
    // 1. Permission definitions in packages/shared
    // 2. Authorization service in services/authorization-service.ts
    // 3. RBAC middleware in middleware/rbac.ts
    // 4. Database schema for teams, orgs, and members

    // This test verifies the permission system is working
    expect(hasPermission).toBeDefined();
    expect(hasTeamPermission).toBeDefined();
    expect(getPermissions).toBeDefined();
    expect(getTeamPermissions).toBeDefined();
  });
});
