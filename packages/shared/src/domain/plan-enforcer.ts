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

/** Check if a user's plan meets the minimum required tier. */
export function meetsMinimumTier(
  userPlan: PlanTier,
  requiredTier: PlanTier,
): boolean {
  return TIER_ORDER.indexOf(userPlan) >= TIER_ORDER.indexOf(requiredTier);
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
  const allowed = PLAN_INTEGRATION_ACCESS[plan] ?? [];
  return allowed.includes(provider);
}

/** Check if creating a new project would exceed plan limits. */
export function canCreateProject(
  plan: PlanTier,
  currentProjectCount: number,
): boolean {
  return currentProjectCount < PLAN_LIMITS[plan].projects;
}

/** Check if running visibility checks would exceed plan limits. */
export function canRunVisibilityChecks(
  plan: PlanTier,
  usedThisMonth: number,
  newCheckCount: number,
): boolean {
  return usedThisMonth + newCheckCount <= PLAN_LIMITS[plan].visibilityChecks;
}
