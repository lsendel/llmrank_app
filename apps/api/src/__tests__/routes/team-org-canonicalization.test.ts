import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Bindings } from "../../index";

const authMiddlewareMock = vi.hoisted(() =>
  vi.fn().mockImplementation(async (_c, next) => {
    await next();
  }),
);

const orgServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  getForUser: vi.fn(),
  getById: vi.fn(),
  listMembers: vi.fn(),
  inviteMember: vi.fn(),
  listInvites: vi.fn(),
  acceptInvite: vi.fn(),
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

const teamQueriesMock = vi.hoisted(() => ({
  create: vi.fn(),
  listByUser: vi.fn().mockResolvedValue([]),
  getMembership: vi.fn(),
  getById: vi.fn(),
  listMembers: vi.fn(),
  createInvitation: vi.fn(),
  getInvitationByToken: vi.fn(),
  addMember: vi.fn(),
  deleteInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

const auditLogQueriesMock = vi.hoisted(() => ({
  listByOrg: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}));

vi.mock("../../middleware/auth", () => ({
  authMiddleware: authMiddlewareMock,
}));

vi.mock("../../services/organization-service", () => ({
  createOrganizationService: vi.fn(() => orgServiceMock),
}));

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    teamQueries: vi.fn(() => teamQueriesMock),
    auditLogQueries: vi.fn(() => auditLogQueriesMock),
  };
});

import { organizationRoutes } from "../../routes/organizations";
import { teamRoutes } from "../../routes/teams";

const baseEnv = {} as unknown as Bindings;

function createOrgApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });
  app.route("/api/orgs", organizationRoutes);
  return app;
}

function createTeamApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });
  app.route("/api/teams", teamRoutes);
  return app;
}

describe("Team + Organization canonicalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamQueriesMock.listByUser.mockResolvedValue([]);
  });

  it("GET /api/orgs/:id returns org details via canonical org service", async () => {
    const app = createOrgApp();
    orgServiceMock.getById.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      slug: "acme",
      createdAt: new Date("2026-02-24T00:00:00.000Z"),
    });

    const res = await app.fetch(
      new Request("http://localhost/api/orgs/org-1"),
      baseEnv,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: {
        id: "org-1",
        name: "Acme",
        slug: "acme",
        createdAt: "2026-02-24T00:00:00.000Z",
      },
    });
    expect(orgServiceMock.getById).toHaveBeenCalledWith("org-1", "user-1");
  });

  it("GET /api/teams includes deprecation headers pointing to /api/orgs", async () => {
    const app = createTeamApp();

    const res = await app.fetch(
      new Request("http://localhost/api/teams"),
      baseEnv,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Link")).toContain("/api/orgs");
    await expect(res.json()).resolves.toEqual({ data: [] });
  });
});
