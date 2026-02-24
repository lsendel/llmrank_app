import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { createMemoryKV } from "./helpers";

describe("OAuth Dynamic Client Registration", () => {
  let env: { KV: KVNamespace; API_BASE_URL: string };

  beforeEach(() => {
    env = {
      KV: createMemoryKV(),
      API_BASE_URL: "https://api.llmboost.test",
    };
  });

  it("registers a client with valid HTTPS redirect_uri", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
          client_name: "Test App",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty("client_id");
    expect(body.client_id).toMatch(/^client_/);
    expect(body.client_name).toBe("Test App");
    expect(body.redirect_uris).toEqual(["https://example.com/callback"]);
  });

  it("registers a client with localhost redirect_uri (HTTP allowed)", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://localhost:3000/callback"],
          client_name: "Dev App",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty("client_id");
    expect(body.redirect_uris).toEqual(["http://localhost:3000/callback"]);
  });

  it("registers a client with 127.0.0.1 redirect_uri (HTTP allowed)", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://127.0.0.1:8080/callback"],
          client_name: "Local App",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty("client_id");
    expect(body.redirect_uris).toEqual(["http://127.0.0.1:8080/callback"]);
  });

  it("rejects HTTP redirect_uri for non-localhost host", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://example.com/callback"],
          client_name: "Insecure App",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_redirect_uri");
    expect(body.error_description).toMatch(/HTTPS or localhost/i);
  });

  it("rejects an invalid URI in redirect_uris", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["not-a-valid-uri"],
          client_name: "Bad App",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_redirect_uri");
  });

  it("allows registration without redirect_uris (defaults to empty array)", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "No Redirect App",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty("client_id");
    expect(body.redirect_uris).toEqual([]);
  });

  it("defaults client_name to 'MCP Client' when not provided", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.client_name).toBe("MCP Client");
  });

  it("defaults grant_types and response_types", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.grant_types).toEqual(["authorization_code", "refresh_token"]);
    expect(body.response_types).toEqual(["code"]);
    expect(body.token_endpoint_auth_method).toBe("none");
  });

  it("includes client_id_issued_at timestamp", async () => {
    const before = Math.floor(Date.now() / 1000);

    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
          client_name: "Timestamp Test",
        }),
      },
      env,
    );

    const after = Math.floor(Date.now() / 1000);

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty("client_id_issued_at");
    expect(body.client_id_issued_at).toBeGreaterThanOrEqual(before);
    expect(body.client_id_issued_at).toBeLessThanOrEqual(after);
  });

  it("stores the client in KV for later retrieval", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
          client_name: "Stored App",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;

    // Verify client is stored in KV
    const stored = await env.KV.get(`oauth:client:${body.client_id}`);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.client_id).toBe(body.client_id);
    expect(parsed.client_name).toBe("Stored App");
  });

  it("generates unique client_ids for each registration", async () => {
    const makeRequest = () =>
      app.request(
        "/oauth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            redirect_uris: ["https://example.com/callback"],
            client_name: "App",
          }),
        },
        env,
      );

    const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);
    const body1 = (await res1.json()) as any;
    const body2 = (await res2.json()) as any;

    expect(body1.client_id).not.toBe(body2.client_id);
  });

  it("registers a client with multiple redirect_uris", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [
            "https://example.com/callback",
            "https://example.com/oauth/redirect",
            "http://localhost:3000/callback",
          ],
          client_name: "Multi Redirect App",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.redirect_uris).toHaveLength(3);
  });

  it("rejects if any redirect_uri in the list is invalid", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [
            "https://example.com/callback",
            "http://evil.com/steal", // HTTP non-localhost
          ],
          client_name: "Mixed App",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_redirect_uri");
  });
});
