import { Plan } from "./plan";
import type { PlanTier } from "../constants/plans";

export class ProjectAggregate {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly domain: string,
    private readonly activeCrawlId: string | null,
  ) {}

  isOwnedBy(uid: string): boolean {
    return this.userId === uid;
  }

  canStartCrawl(plan: PlanTier, creditsRemaining: number): boolean {
    if (this.activeCrawlId) return false;
    return creditsRemaining > 0;
  }

  canAddPage(currentPageCount: number, plan: PlanTier): boolean {
    return currentPageCount < Plan.from(plan).maxPagesPerCrawl;
  }
}
