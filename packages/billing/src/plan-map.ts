export const STRIPE_PLAN_MAP: Record<string, string> = {
  price_starter: "starter",
  price_pro: "pro",
  price_agency: "agency",
};

export const PLAN_TO_PRICE: Record<string, string> = Object.fromEntries(
  Object.entries(STRIPE_PLAN_MAP).map(([priceId, planCode]) => [
    planCode,
    priceId,
  ]),
);

export function planCodeFromPriceId(priceId: string): string | undefined {
  return STRIPE_PLAN_MAP[priceId];
}

export function priceIdFromPlanCode(planCode: string): string | undefined {
  return PLAN_TO_PRICE[planCode];
}
