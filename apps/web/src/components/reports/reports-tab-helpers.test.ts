import { describe, expect, it } from "vitest";
import {
  inferAudienceFromSchedule,
  parseRecipientEmails,
} from "./reports-tab-helpers";

describe("reports-tab helpers", () => {
  it("parses recipient emails with dedupe and invalid capture", () => {
    expect(
      parseRecipientEmails(
        "TEAM@example.com; owner@example.com, invalid, team@example.com",
      ),
    ).toEqual({
      valid: ["team@example.com", "owner@example.com"],
      invalid: ["invalid"],
    });
  });

  it("infers the matching audience from report schedule format and type", () => {
    expect(
      inferAudienceFromSchedule({
        id: "sched-1",
        projectId: "proj-1",
        recipientEmail: "client@example.com",
        format: "docx",
        type: "detailed",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).toBe("content_lead");
  });
});
