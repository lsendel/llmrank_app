import {
  PLAN_LIMITS,
  type PlanTier,
  type PlanLimits,
} from "../constants/plans";
import {
  PLAN_INTEGRATION_ACCESS,
  type IntegrationProvider,
} from "../constants/integrations";

const TIER_ORDER: PlanTier[] = ["free", "starter", "pro", "agency"];

export class Plan {
  private constructor(
    public readonly tier: PlanTier,
    private readonly limits: PlanLimits,
  ) {}

  static from(tier: PlanTier): Plan {
    return new Plan(tier, PLAN_LIMITS[tier]);
  }

  get maxProjects(): number {
    return this.limits.projects;
  }

  get maxPagesPerCrawl(): number {
    return this.limits.pagesPerCrawl;
  }

  get maxCrawlsPerMonth(): number {
    return this.limits.crawlsPerMonth;
  }

  canCreateProject(currentCount: number): boolean {
    return currentCount < this.limits.projects;
  }

  meetsMinimumTier(required: PlanTier): boolean {
    return TIER_ORDER.indexOf(this.tier) >= TIER_ORDER.indexOf(required);
  }

  canAccessIntegration(provider: IntegrationProvider): boolean {
    return (PLAN_INTEGRATION_ACCESS[this.tier] ?? []).includes(provider);
  }

  canRunVisibilityChecks(usedThisMonth: number, newCount: number): boolean {
    return usedThisMonth + newCount <= this.limits.visibilityChecks;
  }

  canGenerateReport(
    usedThisMonth: number,
    reportType: "summary" | "detailed",
  ): boolean {
    if (usedThisMonth >= this.limits.reportsPerMonth) return false;
    return this.limits.reportTypes.includes(reportType);
  }
}
