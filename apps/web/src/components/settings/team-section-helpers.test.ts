import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  buildOrganizationSlug,
  formatTeamDate,
  inviteStatusBadgeVariant,
  resolveTeamErrorMessage,
  roleBadgeVariant,
  validateInviteEmail,
  validateOrganizationForm,
} from "./team-section-helpers";

describe("team section helpers", () => {
  it("maps role and invite status badges", () => {
    expect(roleBadgeVariant("owner")).toBe("default");
    expect(roleBadgeVariant("admin")).toBe("destructive");
    expect(roleBadgeVariant("member")).toBe("secondary");
    expect(roleBadgeVariant("viewer")).toBe("outline");

    expect(inviteStatusBadgeVariant("pending")).toBe("outline");
    expect(inviteStatusBadgeVariant("accepted")).toBe("default");
    expect(inviteStatusBadgeVariant("expired")).toBe("secondary");
  });

  it("builds slugs, validates forms, and formats dates", () => {
    expect(buildOrganizationSlug("Acme Inc. Team")).toBe("acme-inc-team");
    expect(validateOrganizationForm("", "acme")).toBe(
      "Organization name is required.",
    );
    expect(validateOrganizationForm("Acme", "Bad Slug")).toBe(
      "Slug must only contain lowercase letters, numbers, and hyphens.",
    );
    expect(validateOrganizationForm("Acme", "acme-team")).toBeNull();
    expect(validateInviteEmail("")).toBe("Email address is required.");
    expect(validateInviteEmail("teammate@example.com")).toBeNull();
    expect(formatTeamDate("2026-03-07T12:00:00.000Z")).toBe(
      new Date("2026-03-07T12:00:00.000Z").toLocaleDateString(),
    );
  });

  it("resolves api and generic error messages", () => {
    expect(
      resolveTeamErrorMessage(
        new ApiError(409, "ORG_EXISTS", "Org exists"),
        "fallback",
      ),
    ).toBe("Org exists");
    expect(resolveTeamErrorMessage(new Error("Network down"), "fallback")).toBe(
      "Network down",
    );
    expect(resolveTeamErrorMessage("unknown", "fallback")).toBe("fallback");
  });
});
