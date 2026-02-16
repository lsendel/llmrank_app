import { describe, it, expect } from "vitest";
import { getStatusBadgeVariant } from "../status";

describe("getStatusBadgeVariant", () => {
  it('returns "success" for complete', () => {
    expect(getStatusBadgeVariant("complete")).toBe("success");
  });

  it('returns "destructive" for failed', () => {
    expect(getStatusBadgeVariant("failed")).toBe("destructive");
  });

  it('returns "warning" for crawling', () => {
    expect(getStatusBadgeVariant("crawling")).toBe("warning");
  });

  it('returns "warning" for scoring', () => {
    expect(getStatusBadgeVariant("scoring")).toBe("warning");
  });

  it('returns "secondary" for pending', () => {
    expect(getStatusBadgeVariant("pending")).toBe("secondary");
  });

  it('returns "secondary" for unknown status', () => {
    expect(getStatusBadgeVariant("unknown")).toBe("secondary");
  });

  it('returns "secondary" for empty string', () => {
    expect(getStatusBadgeVariant("")).toBe("secondary");
  });
});
