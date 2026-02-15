import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockGetById,
  mockListByProject,
  mockUpdateCredentials,
  mockCreateBatch,
  mockUpdateLastSync,
  mockRunEnrichments,
  mockDecrypt,
  mockEncrypt,
  mockRefreshAccessToken,
} = vi.hoisted(() => ({
  mockGetById: vi.fn(),
  mockListByProject: vi.fn(),
  mockUpdateCredentials: vi.fn(),
  mockCreateBatch: vi.fn(),
  mockUpdateLastSync: vi.fn(),
  mockRunEnrichments: vi.fn().mockResolvedValue([]),
  mockDecrypt: vi.fn(),
  mockEncrypt: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock("@llm-boost/db", () => ({
  createDb: vi.fn().mockReturnValue({}),
  projectQueries: vi.fn(() => ({
    getById: mockGetById,
  })),
  integrationQueries: vi.fn(() => ({
    listByProject: mockListByProject,
    updateCredentials: mockUpdateCredentials,
    updateLastSync: mockUpdateLastSync,
  })),
  enrichmentQueries: vi.fn(() => ({
    createBatch: mockCreateBatch,
  })),
}));

vi.mock("@llm-boost/integrations", () => ({
  runEnrichments: mockRunEnrichments,
}));

vi.mock("../../lib/crypto", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
}));

vi.mock("../../lib/google-oauth", () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

import { runIntegrationEnrichments } from "../../services/enrichments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    databaseUrl: "postgresql://test",
    encryptionKey: "abc123hex",
    googleClientId: "goog-client-id",
    googleClientSecret: "goog-client-secret",
    projectId: "proj-1",
    jobId: "job-1",
    insertedPages: [
      { id: "page-1", url: "https://example.com/page1" },
      { id: "page-2", url: "https://example.com/page2" },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runIntegrationEnrichments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetById.mockResolvedValue({
      id: "proj-1",
      domain: "https://example.com",
      name: "Test Project",
    });
    mockDecrypt.mockResolvedValue(JSON.stringify({ accessToken: "token-123" }));
    mockEncrypt.mockResolvedValue("encrypted-new-creds");
  });

  it("returns early when project not found", async () => {
    mockGetById.mockResolvedValue(null);
    await runIntegrationEnrichments(baseInput());
    expect(mockListByProject).not.toHaveBeenCalled();
  });

  it("returns early when no enabled integrations exist", async () => {
    mockListByProject.mockResolvedValue([]);
    await runIntegrationEnrichments(baseInput());
    expect(mockRunEnrichments).not.toHaveBeenCalled();
  });

  it("filters out disabled integrations", async () => {
    mockListByProject.mockResolvedValue([
      {
        id: "int-1",
        provider: "psi",
        enabled: false,
        encryptedCredentials: "enc",
        config: {},
        tokenExpiresAt: null,
      },
    ]);
    await runIntegrationEnrichments(baseInput());
    expect(mockRunEnrichments).not.toHaveBeenCalled();
  });

  it("filters out integrations without credentials", async () => {
    mockListByProject.mockResolvedValue([
      {
        id: "int-1",
        provider: "psi",
        enabled: true,
        encryptedCredentials: null,
        config: {},
        tokenExpiresAt: null,
      },
    ]);
    await runIntegrationEnrichments(baseInput());
    expect(mockRunEnrichments).not.toHaveBeenCalled();
  });

  it("runs enrichments for enabled integrations and stores results", async () => {
    mockListByProject.mockResolvedValue([
      {
        id: "int-1",
        provider: "psi",
        enabled: true,
        encryptedCredentials: "encrypted-creds",
        config: { property: "UA-123" },
        tokenExpiresAt: null,
      },
    ]);
    mockRunEnrichments.mockResolvedValue([
      {
        pageUrl: "https://example.com/page1",
        provider: "psi",
        data: { score: 95 },
      },
    ]);

    await runIntegrationEnrichments(baseInput());

    expect(mockDecrypt).toHaveBeenCalledWith("encrypted-creds", "abc123hex");
    expect(mockRunEnrichments).toHaveBeenCalledWith(
      [
        {
          provider: "psi",
          integrationId: "int-1",
          credentials: { accessToken: "token-123" },
          config: { property: "UA-123" },
        },
      ],
      "https://example.com",
      ["https://example.com/page1", "https://example.com/page2"],
    );
    expect(mockCreateBatch).toHaveBeenCalledWith([
      {
        pageId: "page-1",
        jobId: "job-1",
        provider: "psi",
        data: { score: 95 },
      },
    ]);
    expect(mockUpdateLastSync).toHaveBeenCalledWith("int-1", null);
  });

  it("refreshes expired OAuth tokens for GSC/GA4 providers", async () => {
    const expiredDate = new Date(Date.now() - 1000); // expired
    mockListByProject.mockResolvedValue([
      {
        id: "int-gsc",
        provider: "gsc",
        enabled: true,
        encryptedCredentials: "enc-gsc",
        config: {},
        tokenExpiresAt: expiredDate,
      },
    ]);
    mockDecrypt.mockResolvedValue(
      JSON.stringify({
        accessToken: "old-token",
        refreshToken: "refresh-token-123",
      }),
    );
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: "new-token",
      expiresIn: 3600,
    });
    mockRunEnrichments.mockResolvedValue([]);

    await runIntegrationEnrichments(baseInput());

    expect(mockRefreshAccessToken).toHaveBeenCalledWith({
      refreshToken: "refresh-token-123",
      clientId: "goog-client-id",
      clientSecret: "goog-client-secret",
    });
    expect(mockEncrypt).toHaveBeenCalled();
    expect(mockUpdateCredentials).toHaveBeenCalledWith(
      "int-gsc",
      "encrypted-new-creds",
      expect.any(Date),
    );
  });

  it("does not refresh tokens if not expired", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // still valid
    mockListByProject.mockResolvedValue([
      {
        id: "int-gsc",
        provider: "gsc",
        enabled: true,
        encryptedCredentials: "enc-gsc",
        config: {},
        tokenExpiresAt: futureDate,
      },
    ]);
    mockDecrypt.mockResolvedValue(
      JSON.stringify({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
      }),
    );
    mockRunEnrichments.mockResolvedValue([]);

    await runIntegrationEnrichments(baseInput());

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("does not refresh tokens for non-OAuth providers", async () => {
    const expiredDate = new Date(Date.now() - 1000);
    mockListByProject.mockResolvedValue([
      {
        id: "int-psi",
        provider: "psi",
        enabled: true,
        encryptedCredentials: "enc-psi",
        config: {},
        tokenExpiresAt: expiredDate,
      },
    ]);
    mockRunEnrichments.mockResolvedValue([]);

    await runIntegrationEnrichments(baseInput());

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("does not insert enrichments when results don't match page URLs", async () => {
    mockListByProject.mockResolvedValue([
      {
        id: "int-1",
        provider: "psi",
        enabled: true,
        encryptedCredentials: "enc",
        config: {},
        tokenExpiresAt: null,
      },
    ]);
    mockRunEnrichments.mockResolvedValue([
      {
        pageUrl: "https://unknown.com/not-in-batch",
        provider: "psi",
        data: { score: 50 },
      },
    ]);

    await runIntegrationEnrichments(baseInput());

    expect(mockCreateBatch).not.toHaveBeenCalled();
  });

  it("updates lastSyncAt for each integration after processing", async () => {
    mockListByProject.mockResolvedValue([
      {
        id: "int-1",
        provider: "psi",
        enabled: true,
        encryptedCredentials: "enc",
        config: {},
        tokenExpiresAt: null,
      },
      {
        id: "int-2",
        provider: "clarity",
        enabled: true,
        encryptedCredentials: "enc2",
        config: {},
        tokenExpiresAt: null,
      },
    ]);
    mockRunEnrichments.mockResolvedValue([]);

    await runIntegrationEnrichments(baseInput());

    expect(mockUpdateLastSync).toHaveBeenCalledTimes(2);
    expect(mockUpdateLastSync).toHaveBeenCalledWith("int-1", null);
    expect(mockUpdateLastSync).toHaveBeenCalledWith("int-2", null);
  });
});
