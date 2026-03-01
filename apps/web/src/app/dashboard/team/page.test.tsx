import LegacyTeamPage from "@/app/dashboard/team/page";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Legacy team route", () => {
  it("redirects to canonical settings team tab", () => {
    LegacyTeamPage();
    expect(redirect).toHaveBeenCalledWith("/dashboard/settings?tab=team");
  });
});
