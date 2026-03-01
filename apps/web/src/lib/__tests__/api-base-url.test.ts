import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../api-base-url";

describe("resolveApiBaseUrl", () => {
  it("uses configured NEXT_PUBLIC_API_URL when provided", () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: "https://api.llmrank.app/",
        hostname: "llmrank.app",
      }),
    ).toBe("https://api.llmrank.app");
  });

  it("falls back to localhost API on server", () => {
    expect(resolveApiBaseUrl({ isServer: true, nodeEnv: "development" })).toBe(
      "http://localhost:8787",
    );
  });

  it("does not force localhost API on server in production without explicit base url", () => {
    expect(resolveApiBaseUrl({ isServer: true, nodeEnv: "production" })).toBe(
      "",
    );
  });

  it("falls back to localhost API for local browser hosts", () => {
    expect(resolveApiBaseUrl({ hostname: "localhost" })).toBe(
      "http://localhost:8787",
    );
    expect(resolveApiBaseUrl({ hostname: "127.0.0.1" })).toBe(
      "http://localhost:8787",
    );
    expect(resolveApiBaseUrl({ hostname: "0.0.0.0" })).toBe(
      "http://localhost:8787",
    );
    expect(resolveApiBaseUrl({ hostname: "preview.localhost" })).toBe(
      "http://localhost:8787",
    );
    expect(resolveApiBaseUrl({ hostname: "host.docker.internal" })).toBe(
      "http://localhost:8787",
    );
    expect(resolveApiBaseUrl({ hostname: "192.168.1.42" })).toBe(
      "http://localhost:8787",
    );
  });

  it("uses relative API path in non-local browser environments", () => {
    expect(resolveApiBaseUrl({ hostname: "app.llmrank.app" })).toBe("");
  });
});
