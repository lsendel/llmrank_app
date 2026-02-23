export const STRIPE_PLAN_MAP: Record<string, string> = {
  // Starter: $79/mo (LLM Rank Starter)
  price_1T16hoD3d5rDMnf2CwobvPH7: "starter",
  // Pro: $149/mo (LLM Rank Pro)
  price_1T16htD3d5rDMnf22eTUcu98: "pro",
  // Agency: $299/mo (LLM Rank Agency)
  price_1T16hyD3d5rDMnf2h6Syzk8d: "agency",
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
