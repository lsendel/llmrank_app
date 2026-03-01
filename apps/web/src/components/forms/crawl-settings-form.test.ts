import { describe, expect, it } from "vitest";
import {
  CRAWL_SCHEDULE_OPTIONS,
  crawlScheduleAccess,
} from "./crawl-settings-form";

describe("crawlScheduleAccess", () => {
  it("keeps daily in the selectable crawl schedule options", () => {
    expect(CRAWL_SCHEDULE_OPTIONS).toEqual([
      "manual",
      "daily",
      "weekly",
      "monthly",
    ]);
  });

  it("locks automatic schedules on free plans", () => {
    expect(crawlScheduleAccess(true)).toEqual({
      dailyDisabled: true,
      weeklyDisabled: true,
      monthlyDisabled: true,
    });
  });

  it("enables daily, weekly, and monthly on paid plans", () => {
    expect(crawlScheduleAccess(false)).toEqual({
      dailyDisabled: false,
      weeklyDisabled: false,
      monthlyDisabled: false,
    });
  });
});
