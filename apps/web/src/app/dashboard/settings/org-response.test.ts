import { describe, expect, it } from "vitest";
import { extractOrgIdFromPayload } from "./org-response";

describe("extractOrgIdFromPayload", () => {
  it("returns org id when API returns a single object", () => {
    expect(
      extractOrgIdFromPayload({
        data: { id: "org_123", name: "Acme" },
      }),
    ).toBe("org_123");
  });

  it("returns first org id when API returns an array", () => {
    expect(
      extractOrgIdFromPayload({
        data: [{ id: "org_abc" }, { id: "org_def" }],
      }),
    ).toBe("org_abc");
  });

  it("returns null for null or empty payloads", () => {
    expect(extractOrgIdFromPayload({ data: null })).toBeNull();
    expect(extractOrgIdFromPayload({ data: [] })).toBeNull();
    expect(extractOrgIdFromPayload(null)).toBeNull();
  });

  it("returns null for malformed data", () => {
    expect(
      extractOrgIdFromPayload({ data: { name: "missing id" } }),
    ).toBeNull();
    expect(extractOrgIdFromPayload({ data: [{ foo: "bar" }] })).toBeNull();
  });
});
