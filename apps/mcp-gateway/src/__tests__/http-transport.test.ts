import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { createMemoryKV } from "./helpers";

describe("MCP HTTP Transport Auth", () => {
  let env: { KV: KVNamespace; API_BASE_URL: string };

  beforeEach(() => {
    env = {
      KV: createMemoryKV(),
      API_BASE_URL: "https://api.llmboost.test",
    };
  });

  it("rejects request with no Authorization header with 401", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_token");
    expect(body.error_description).toBe("Bearer token required");
  });

  it("returns WWW-Authenticate header on 401 response", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    const wwwAuth = res.headers.get("WWW-Authenticate");
    expect(wwwAuth).toBeTruthy();
    expect(wwwAuth).toContain("Bearer");
    expect(wwwAuth).toContain("/.well-known/oauth-protected-resource");
  });

  it("rejects request with invalid OAuth token with 401", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer some-invalid-oauth-token",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_token");
    expect(body.error_description).toContain("Invalid or expired");
  });

  it("passes auth with direct llmb_ API token (not 401)", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer llmb_test_token_abc123",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
        }),
      },
      env,
    );

    // The request passes auth — response should NOT be 401.
    // It may be 200 (MCP response) or 500 (if downstream MCP SDK fails
    // in test env), but the auth layer has been bypassed.
    expect(res.status).not.toBe(401);
  });
});

describe("CORS", () => {
  let env: { KV: KVNamespace; API_BASE_URL: string };

  beforeEach(() => {
    env = {
      KV: createMemoryKV(),
      API_BASE_URL: "https://api.llmboost.test",
    };
  });

  it("responds to OPTIONS preflight with correct Access-Control headers", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      },
      env,
    );

    // Hono CORS middleware responds to OPTIONS with 204
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");

    const allowHeaders = res.headers.get("Access-Control-Allow-Headers") ?? "";
    expect(allowHeaders.toLowerCase()).toContain("authorization");
    expect(allowHeaders.toLowerCase()).toContain("content-type");
    expect(allowHeaders.toLowerCase()).toContain("mcp-session-id");
  });

  it("includes CORS headers on normal responses", async () => {
    const res = await app.request("/health", { method: "GET" }, env);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("Health endpoint", () => {
  it("returns 200 with status ok", async () => {
    const env = {
      KV: createMemoryKV(),
      API_BASE_URL: "https://api.llmboost.test",
    };

    const res = await app.request("/health", { method: "GET" }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("mcp-gateway");
  });
});
