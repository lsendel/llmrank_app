import { describe, expect, it } from "vitest";
import {
  normalizeVisitTimestamp,
  pickMostRecentVisitTimestamp,
} from "../visit-memory";

describe("visit memory helpers", () => {
  it("normalizes valid ISO timestamps and rejects invalid values", () => {
    expect(normalizeVisitTimestamp("2026-03-05T12:00:00.000Z")).toBe(
      "2026-03-05T12:00:00.000Z",
    );
    expect(normalizeVisitTimestamp("")).toBeNull();
    expect(normalizeVisitTimestamp("not-a-date")).toBeNull();
    expect(normalizeVisitTimestamp(null)).toBeNull();
  });

  it("picks the most recent timestamp", () => {
    expect(
      pickMostRecentVisitTimestamp([
        "2026-03-04T12:00:00.000Z",
        "2026-03-05T10:00:00.000Z",
        "2026-03-05T09:00:00.000Z",
      ]),
    ).toBe("2026-03-05T10:00:00.000Z");
  });

  it("ignores invalid entries", () => {
    expect(
      pickMostRecentVisitTimestamp([
        null,
        "invalid",
        "2026-03-05T10:00:00.000Z",
      ]),
    ).toBe("2026-03-05T10:00:00.000Z");
    expect(
      pickMostRecentVisitTimestamp([null, undefined, "invalid"]),
    ).toBeNull();
  });
});
