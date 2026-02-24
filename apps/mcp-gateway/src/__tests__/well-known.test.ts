import { describe, it, expect } from "vitest";
import app from "../index";
import { createMemoryKV } from "./helpers";

describe("Well-Known Endpoints", () => {
  const kv = createMemoryKV();
  const env = { KV: kv, API_BASE_URL: "https://api.llmboost.test" };

  describe("GET /.well-known/oauth-authorization-server", () => {
    it("returns 200 with OAuth authorization server metadata", async () => {
      const res = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body).toHaveProperty("issuer");
      expect(body).toHaveProperty("authorization_endpoint");
      expect(body).toHaveProperty("token_endpoint");
      expect(body).toHaveProperty("registration_endpoint");
    });

    it("includes correct endpoint URLs relative to origin", async () => {
      const res = await app.request(
        "http://localhost/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.issuer).toBe("http://localhost");
      expect(body.authorization_endpoint).toBe(
        "http://localhost/oauth/authorize",
      );
      expect(body.token_endpoint).toBe("http://localhost/oauth/token");
      expect(body.registration_endpoint).toBe(
        "http://localhost/oauth/register",
      );
    });

    it("supports S256 code challenge method", async () => {
      const res = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.code_challenge_methods_supported).toContain("S256");
    });

    it("supports authorization_code and refresh_token grant types", async () => {
      const res = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.grant_types_supported).toContain("authorization_code");
      expect(body.grant_types_supported).toContain("refresh_token");
    });

    it("supports code response type", async () => {
      const res = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.response_types_supported).toContain("code");
    });

    it("uses none for token endpoint auth method", async () => {
      const res = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.token_endpoint_auth_methods_supported).toContain("none");
    });

    it("lists all expected scopes", async () => {
      const res = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const body = (await res.json()) as any;

      const expectedScopes = [
        "projects:read",
        "projects:write",
        "crawls:read",
        "crawls:write",
        "pages:read",
        "scores:read",
        "issues:read",
        "visibility:read",
        "visibility:write",
        "fixes:write",
        "strategy:read",
        "competitors:read",
        "keywords:write",
        "queries:write",
        "reports:write",
        "content:read",
        "technical:read",
      ];

      expect(body.scopes_supported).toEqual(expectedScopes);
    });
  });

  describe("GET /.well-known/oauth-protected-resource", () => {
    it("returns 200 with protected resource metadata", async () => {
      const res = await app.request(
        "/.well-known/oauth-protected-resource",
        {},
        env,
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body).toHaveProperty("resource");
      expect(body).toHaveProperty("authorization_servers");
      expect(body).toHaveProperty("scopes_supported");
      expect(body).toHaveProperty("bearer_methods_supported");
    });

    it("points resource to the MCP endpoint", async () => {
      const res = await app.request(
        "http://localhost/.well-known/oauth-protected-resource",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.resource).toBe("http://localhost/v1/mcp");
    });

    it("lists self as authorization server", async () => {
      const res = await app.request(
        "http://localhost/.well-known/oauth-protected-resource",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.authorization_servers).toEqual(["http://localhost"]);
    });

    it("supports header bearer method", async () => {
      const res = await app.request(
        "/.well-known/oauth-protected-resource",
        {},
        env,
      );
      const body = (await res.json()) as any;

      expect(body.bearer_methods_supported).toContain("header");
    });

    it("lists the same scopes as authorization server metadata", async () => {
      const authServerRes = await app.request(
        "/.well-known/oauth-authorization-server",
        {},
        env,
      );
      const authServerBody = (await authServerRes.json()) as any;

      const resourceRes = await app.request(
        "/.well-known/oauth-protected-resource",
        {},
        env,
      );
      const resourceBody = (await resourceRes.json()) as any;

      expect(resourceBody.scopes_supported).toEqual(
        authServerBody.scopes_supported,
      );
    });
  });
});
