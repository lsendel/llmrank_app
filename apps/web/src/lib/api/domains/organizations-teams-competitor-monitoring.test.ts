import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: vi.fn(),
    delete: deleteMock,
  },
}));

import { createCompetitorMonitoringApi } from "./competitor-monitoring";
import { createOrganizationsApi } from "./organizations";
import { createTeamsApi } from "./teams";

describe("organizations/teams/competitorMonitoring api domains", () => {
  const organizationsApi = createOrganizationsApi();
  const competitorMonitoringApi = createCompetitorMonitoringApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults organization invite role to member", async () => {
    postMock.mockResolvedValue({ data: { id: "invite-1", role: "member" } });

    const result = await organizationsApi.invite("org-1", {
      email: "user@example.com",
    });

    expect(postMock).toHaveBeenCalledWith("/api/orgs/org-1/invites", {
      email: "user@example.com",
      role: "member",
    });
    expect(result).toEqual({ id: "invite-1", role: "member" });
  });

  it("maps organizations into legacy teams and slugifies creation", async () => {
    const createOrganization = vi.fn().mockResolvedValue({
      id: "org-1",
      name: "Acme SEO Team!",
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    const teamsApi = createTeamsApi({
      create: createOrganization,
    } as unknown as ReturnType<typeof createOrganizationsApi>);

    const result = await teamsApi.create("Acme SEO Team!");

    expect(createOrganization).toHaveBeenCalledWith({
      name: "Acme SEO Team!",
      slug: "acme-seo-team",
    });
    expect(result).toEqual({
      id: "org-1",
      name: "Acme SEO Team!",
      ownerId: "",
      plan: "",
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });

  it("maps organization members into legacy team detail members", async () => {
    const teamsApi = createTeamsApi({
      getById: vi.fn().mockResolvedValue({
        id: "org-1",
        name: "Acme",
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
      listMembers: vi.fn().mockResolvedValue([
        {
          id: "member-1",
          userId: "user-1",
          name: "Alex",
          email: "alex@example.com",
          role: "member",
          joinedAt: "2025-01-02T00:00:00.000Z",
        },
      ]),
    } as unknown as ReturnType<typeof createOrganizationsApi>);

    const result = await teamsApi.getById("org-1");

    expect(result).toEqual({
      id: "org-1",
      name: "Acme",
      ownerId: "",
      plan: "",
      role: "owner",
      createdAt: "2025-01-01T00:00:00.000Z",
      members: [
        {
          id: "member-1",
          teamId: "org-1",
          userId: "user-1",
          name: "Alex",
          email: "alex@example.com",
          role: "editor",
          joinedAt: "2025-01-02T00:00:00.000Z",
        },
      ],
    });
  });

  it("builds competitor feed query strings from the provided filters", async () => {
    getMock.mockResolvedValue({ items: [] });

    const result = await competitorMonitoringApi.getFeed("proj-1", {
      limit: 10,
      offset: 20,
      severity: "critical",
      domain: "example.com",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/competitors/feed?projectId=proj-1&limit=10&offset=20&severity=critical&domain=example.com",
    );
    expect(result).toEqual({ items: [] });
  });

  it("posts empty payloads for competitor rebenchmark", async () => {
    postMock.mockResolvedValue({ ok: true });

    const result = await competitorMonitoringApi.rebenchmark("comp-1");

    expect(postMock).toHaveBeenCalledWith(
      "/api/competitors/comp-1/rebenchmark",
      {},
    );
    expect(result).toEqual({ ok: true });
  });
});
