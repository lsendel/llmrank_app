import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  GOOGLE_SCOPES,
} from "../../lib/google-oauth";

let fetchMock: ReturnType<typeof vi.fn>;

describe("google oauth helpers", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the consent URL with all params", () => {
    const url = buildGoogleAuthUrl({
      clientId: "client",
      redirectUri: "https://app/callback",
      state: "state-123",
      scopes: [GOOGLE_SCOPES.gsc, GOOGLE_SCOPES.ga4],
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(parsed.searchParams.get("client_id")).toBe("client");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app/callback",
    );
    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("scope")).toBe(
      `${GOOGLE_SCOPES.gsc} ${GOOGLE_SCOPES.ga4}`,
    );
  });

  it("exchanges an auth code for tokens", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        scope: "scope-a",
      }),
    });

    const result = await exchangeCodeForTokens({
      code: "code",
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://app/callback",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 3600,
      scope: "scope-a",
    });
  });

  it("throws when Google rejects the exchange", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => "invalid grant",
    });

    await expect(
      exchangeCodeForTokens({
        code: "code",
        clientId: "client",
        clientSecret: "secret",
        redirectUri: "https://app/callback",
      }),
    ).rejects.toThrow("Google token exchange failed: invalid grant");
  });

  it("refreshes the access token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", expires_in: 1000 }),
    });

    const result = await refreshAccessToken({
      refreshToken: "refresh",
      clientId: "client",
      clientSecret: "secret",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ accessToken: "new-access", expiresIn: 1000 });
  });

  it("throws when token refresh fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => "forbidden",
    });

    await expect(
      refreshAccessToken({
        refreshToken: "refresh",
        clientId: "client",
        clientSecret: "secret",
      }),
    ).rejects.toThrow("Google token refresh failed: forbidden");
  });
});
