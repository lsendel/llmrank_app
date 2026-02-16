import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createApiTokenService,
  type ApiTokenRepository,
  type ApiToken,
} from "../../services/api-token-service";
import { createMockProjectRepo } from "../helpers/mock-repositories";
import { buildUser, buildProject } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATIC_DATE = new Date("2024-01-01T00:00:00.000Z");

function buildApiToken(overrides: Partial<ApiToken> = {}): ApiToken {
  return {
    id: "token-1",
    userId: "user-1",
    projectId: "proj-1",
    name: "My Token",
    tokenHash: "hashed-value",
    tokenPrefix: "llmb_abc",
    scopes: ["metrics:read"],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: STATIC_DATE,
    ...overrides,
  };
}

function createMockApiTokenRepo(
  overrides: Partial<{
    [K in keyof ApiTokenRepository]: ReturnType<typeof vi.fn>;
  }> = {},
): { [K in keyof ApiTokenRepository]: ReturnType<typeof vi.fn> } {
  return {
    create: vi.fn().mockImplementation(async (data) =>
      buildApiToken({
        ...data,
        id: "token-new",
        lastUsedAt: null,
        revokedAt: null,
        createdAt: STATIC_DATE,
      }),
    ),
    findByHash: vi.fn().mockResolvedValue(null),
    listByUser: vi.fn().mockResolvedValue([]),
    revoke: vi.fn().mockResolvedValue(null),
    updateLastUsed: vi.fn().mockResolvedValue(undefined),
    countByUser: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ApiTokenService", () => {
  let tokenRepo: ReturnType<typeof createMockApiTokenRepo>;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenRepo = createMockApiTokenRepo();
    projectRepo = createMockProjectRepo();
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("generates llmb_ prefixed token, stores hash (not plaintext), returns plaintext", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: user.id });
      projectRepo.getById.mockResolvedValue(project);
      tokenRepo.countByUser.mockResolvedValue(0);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      const result = await service.create({
        userId: user.id,
        userPlan: user.plan,
        projectId: project.id,
        name: "CI Token",
        scopes: ["metrics:read"],
      });

      // Token starts with llmb_
      expect(result.plainToken).toMatch(/^llmb_/);

      // Plaintext token is long enough (llmb_ + base62 of 32 bytes ~ 43 chars)
      expect(result.plainToken.length).toBeGreaterThan(10);

      // create() was called with a hash, not the plaintext
      expect(tokenRepo.create).toHaveBeenCalledOnce();
      const createArg = tokenRepo.create.mock.calls[0][0];
      expect(createArg.tokenHash).toBeDefined();
      expect(createArg.tokenHash).not.toBe(result.plainToken);
      expect(createArg.tokenHash).not.toContain("llmb_");

      // Prefix is stored (first 8 chars of token)
      expect(createArg.tokenPrefix).toBe(result.plainToken.slice(0, 9));

      // Name and scopes passed through
      expect(createArg.name).toBe("CI Token");
      expect(createArg.scopes).toEqual(["metrics:read"]);
    });

    it("rejects for free plan (PLAN_LIMIT_REACHED)", async () => {
      const user = buildUser({ plan: "free" });
      const project = buildProject({ userId: user.id });
      projectRepo.getById.mockResolvedValue(project);
      tokenRepo.countByUser.mockResolvedValue(0);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          userPlan: "free",
          projectId: project.id,
          name: "Token",
          scopes: ["metrics:read"],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "PLAN_LIMIT_REACHED",
          status: 403,
        }),
      );
    });

    it("rejects for starter plan (PLAN_LIMIT_REACHED)", async () => {
      const user = buildUser({ plan: "starter" });
      const project = buildProject({ userId: user.id });
      projectRepo.getById.mockResolvedValue(project);
      tokenRepo.countByUser.mockResolvedValue(0);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          userPlan: "starter",
          projectId: project.id,
          name: "Token",
          scopes: ["metrics:read"],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "PLAN_LIMIT_REACHED",
          status: 403,
        }),
      );
    });

    it("rejects when limit reached (Pro with 3 existing tokens)", async () => {
      const user = buildUser({ plan: "pro" });
      const project = buildProject({ userId: user.id });
      projectRepo.getById.mockResolvedValue(project);
      tokenRepo.countByUser.mockResolvedValue(3); // Pro limit is 3

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          userPlan: "pro",
          projectId: project.id,
          name: "Token",
          scopes: ["metrics:read"],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "PLAN_LIMIT_REACHED",
          status: 403,
        }),
      );
    });

    it("rejects for non-owned project", async () => {
      const user = buildUser({ id: "user-1", plan: "pro" });
      const project = buildProject({ userId: "other-user" });
      projectRepo.getById.mockResolvedValue(project);
      tokenRepo.countByUser.mockResolvedValue(0);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          userPlan: "pro",
          projectId: project.id,
          name: "Token",
          scopes: ["metrics:read"],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "NOT_FOUND",
          status: 404,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // authenticate
  // -------------------------------------------------------------------------

  describe("authenticate", () => {
    it("returns token context for valid token", async () => {
      const token = buildApiToken({
        id: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read", "scores:read"],
      });

      // We need to set up findByHash to return the token when called with the correct hash
      tokenRepo.findByHash.mockResolvedValue(token);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      const result = await service.authenticate("llmb_somerawtoken123");

      expect(result).not.toBeNull();
      expect(result).toEqual({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read", "scores:read"],
      });

      // Should have called findByHash with a SHA-256 hash (hex string)
      expect(tokenRepo.findByHash).toHaveBeenCalledOnce();
      const hashArg = tokenRepo.findByHash.mock.calls[0][0];
      // SHA-256 hex is 64 characters
      expect(hashArg).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns null for unknown token", async () => {
      tokenRepo.findByHash.mockResolvedValue(null);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      const result = await service.authenticate("llmb_unknown_token");

      expect(result).toBeNull();
      expect(tokenRepo.updateLastUsed).not.toHaveBeenCalled();
    });

    it("updates lastUsedAt on successful authentication", async () => {
      const token = buildApiToken({ id: "token-1" });
      tokenRepo.findByHash.mockResolvedValue(token);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      await service.authenticate("llmb_validtoken");

      expect(tokenRepo.updateLastUsed).toHaveBeenCalledWith("token-1");
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe("list", () => {
    it("returns user's tokens", async () => {
      const tokens = [
        {
          id: "t1",
          name: "Token 1",
          tokenPrefix: "llmb_abc",
          scopes: ["metrics:read"],
          projectId: "p1",
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: STATIC_DATE,
        },
        {
          id: "t2",
          name: "Token 2",
          tokenPrefix: "llmb_def",
          scopes: ["scores:read"],
          projectId: "p2",
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: STATIC_DATE,
        },
      ];
      tokenRepo.listByUser.mockResolvedValue(tokens);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      const result = await service.list("user-1");

      expect(result).toEqual(tokens);
      expect(tokenRepo.listByUser).toHaveBeenCalledWith("user-1");
    });
  });

  // -------------------------------------------------------------------------
  // revoke
  // -------------------------------------------------------------------------

  describe("revoke", () => {
    it("revokes owned token", async () => {
      const token = buildApiToken({
        id: "token-1",
        userId: "user-1",
      });
      // listByUser returns tokens for the user (to verify ownership)
      tokenRepo.listByUser.mockResolvedValue([
        {
          id: token.id,
          name: token.name,
          tokenPrefix: token.tokenPrefix,
          scopes: token.scopes,
          projectId: token.projectId,
          lastUsedAt: token.lastUsedAt,
          expiresAt: token.expiresAt,
          revokedAt: token.revokedAt,
          createdAt: token.createdAt,
        },
      ]);
      tokenRepo.revoke.mockResolvedValue({
        ...token,
        revokedAt: new Date(),
      });

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      const result = await service.revoke("user-1", "token-1");

      expect(result).toBeDefined();
      expect(result!.revokedAt).toBeDefined();
      expect(tokenRepo.revoke).toHaveBeenCalledWith("token-1");
    });

    it("rejects for token not found (not owned by user)", async () => {
      // User has no tokens
      tokenRepo.listByUser.mockResolvedValue([]);

      const service = createApiTokenService({
        apiTokens: tokenRepo,
        projects: projectRepo,
      });

      await expect(
        service.revoke("user-1", "token-nonexistent"),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "NOT_FOUND",
          status: 404,
        }),
      );

      expect(tokenRepo.revoke).not.toHaveBeenCalled();
    });
  });
});
