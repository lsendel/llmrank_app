import { describe, expect, it } from "vitest";
import {
  NEW_PROJECT_SCHEDULE_OPTIONS,
  NEW_PROJECT_WORKFLOW_ACTIONS,
  NEW_PROJECT_WORKFLOW_STEPS,
  getNewProjectSubmitLabel,
  validateNewProjectForm,
} from "./new-project-page-helpers";

describe("new project page helpers", () => {
  it("exposes workflow metadata and schedule options", () => {
    expect(NEW_PROJECT_WORKFLOW_ACTIONS.map((item) => item.label)).toEqual([
      "Back to Projects",
      "Account Settings",
    ]);
    expect(NEW_PROJECT_WORKFLOW_STEPS.map((item) => item.title)).toEqual([
      "Set crawl and automation defaults",
      "Run the first crawl immediately",
      "Enable weekly communication loops",
    ]);
    expect(NEW_PROJECT_SCHEDULE_OPTIONS.map((item) => item.value)).toEqual([
      "manual",
      "daily",
      "weekly",
      "monthly",
    ]);
  });

  it("validates form input and derives the submit label", () => {
    expect(validateNewProjectForm({ name: "", domain: "" })).toEqual({
      name: "Name is required and must be 100 characters or fewer.",
      domain: "Domain is required.",
    });
    expect(
      validateNewProjectForm({
        name: "Launch Workspace",
        domain: "https://www.example.com/path",
      }),
    ).toEqual({});
    expect(getNewProjectSubmitLabel(false, true)).toBe("Create Project");
    expect(getNewProjectSubmitLabel(true, true)).toBe(
      "Creating & Starting Crawl...",
    );
    expect(getNewProjectSubmitLabel(true, false)).toBe("Creating...");
  });
});
