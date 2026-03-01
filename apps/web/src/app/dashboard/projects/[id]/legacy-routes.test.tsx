import { describe, expect, it, vi, beforeEach } from "vitest";
import LegacyIssuesPage from "./issues/page";
import LegacyPagesPage from "./pages/page";
import LegacyHistoryPage from "./history/page";
import LegacyReportsPage from "./reports/page";
import LegacyLogsPage from "./logs/page";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

describe("legacy project route redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects /issues to canonical tab route", async () => {
    await LegacyIssuesPage({ params: Promise.resolve({ id: "proj-1" }) });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=issues",
    );
  });

  it("redirects /pages to canonical tab route", async () => {
    await LegacyPagesPage({ params: Promise.resolve({ id: "proj-1" }) });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=pages",
    );
  });

  it("redirects /history to canonical tab route", async () => {
    await LegacyHistoryPage({ params: Promise.resolve({ id: "proj-1" }) });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=history",
    );
  });

  it("redirects /reports to canonical tab route", async () => {
    await LegacyReportsPage({ params: Promise.resolve({ id: "proj-1" }) });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=reports",
    );
  });

  it("redirects /logs to canonical tab route", async () => {
    await LegacyLogsPage({ params: Promise.resolve({ id: "proj-1" }) });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/projects/proj-1?tab=logs",
    );
  });
});
