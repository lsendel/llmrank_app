import { describe, expect, it } from "vitest";
import { normalizeStringArrayField } from "./persona-fields";

describe("normalizeStringArrayField", () => {
  it("passes through string arrays", () => {
    expect(normalizeStringArrayField(["senior care", 123, "Medicaid"])).toEqual(
      ["senior care", "Medicaid"],
    );
  });

  it("parses legacy D1 JSON text fields", () => {
    expect(
      normalizeStringArrayField('["assisted living near me","home care"]'),
    ).toEqual(["assisted living near me", "home care"]);
  });

  it("returns an empty array for invalid values", () => {
    expect(normalizeStringArrayField("not json")).toEqual([]);
    expect(normalizeStringArrayField(null)).toEqual([]);
  });
});
