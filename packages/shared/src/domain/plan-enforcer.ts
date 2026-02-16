import {
  PLAN_LIMITS,
  type PlanTier,
  type PlanLimits,
} from "../constants/plans";
import type { IntegrationProvider } from "../constants/integrations";
import { Plan } from "./plan";

/** Check if a user's plan meets the minimum required tier. */
export function meetsMinimumTier(
  userPlan: PlanTier,
  requiredTier: PlanTier,
): boolean {
  return Plan.from(userPlan).meetsMinimumTier(requiredTier);
}

/** Get plan limits for a given plan tier. */
export function getLimits(plan: PlanTier): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** Check if a plan allows access to a specific integration provider. */
export function canAccessIntegration(
  plan: PlanTier,
  provider: IntegrationProvider,
): boolean {
  return Plan.from(plan).canAccessIntegration(provider);
}

/** Check if creating a new project would exceed plan limits. */
export function canCreateProject(
  plan: PlanTier,
  currentProjectCount: number,
): boolean {
  return Plan.from(plan).canCreateProject(currentProjectCount);
}

/** Check if running visibility checks would exceed plan limits. */
export function canRunVisibilityChecks(
  plan: PlanTier,
  usedThisMonth: number,
  newCheckCount: number,
): boolean {
  return Plan.from(plan).canRunVisibilityChecks(usedThisMonth, newCheckCount);
}

/** Check if generating a report would exceed plan limits. */
export function canGenerateReport(
  plan: PlanTier,
  usedThisMonth: number,
  reportType: "summary" | "detailed",
): boolean {
  return Plan.from(plan).canGenerateReport(usedThisMonth, reportType);
}
