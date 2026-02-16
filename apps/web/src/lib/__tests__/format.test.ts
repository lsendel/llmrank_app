import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "../format";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns minutes ago for < 60 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:30:00Z"));
    expect(formatRelativeTime("2024-06-15T12:20:00Z")).toBe("10m ago");
  });

  it("returns 0m ago for just now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    expect(formatRelativeTime("2024-06-15T12:00:00Z")).toBe("0m ago");
  });

  it("returns hours ago for < 24 hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T15:00:00Z"));
    expect(formatRelativeTime("2024-06-15T12:00:00Z")).toBe("3h ago");
  });

  it("returns days ago for < 7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-18T12:00:00Z"));
    expect(formatRelativeTime("2024-06-15T12:00:00Z")).toBe("3d ago");
  });

  it("returns formatted date for >= 7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-25T12:00:00Z"));
    const result = formatRelativeTime("2024-06-15T12:00:00Z");
    // toLocaleDateString format varies by locale, just verify it's not "Xd ago"
    expect(result).not.toMatch(/\d+d ago/);
    expect(result).not.toMatch(/\d+h ago/);
    expect(result).not.toMatch(/\d+m ago/);
  });

  it("returns 59m ago at the boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:59:00Z"));
    expect(formatRelativeTime("2024-06-15T12:00:00Z")).toBe("59m ago");
  });

  it("returns 1h ago at 60 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T13:00:00Z"));
    expect(formatRelativeTime("2024-06-15T12:00:00Z")).toBe("1h ago");
  });

  it("returns 6d ago at 6 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-21T12:00:00Z"));
    expect(formatRelativeTime("2024-06-15T12:00:00Z")).toBe("6d ago");
  });
});
