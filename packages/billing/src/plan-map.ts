export const STRIPE_PLAN_MAP: Record<string, string> = {
  // Starter: $79/mo (LLM Rank Starter) — LIVE
  price_0Tm0MzZZhIaYsPbse5oXoLHf: "starter",
  // Pro: $149/mo (LLM Rank Pro) — LIVE
  price_0Tm0N8ZZhIaYsPbsj1ey2EvF: "pro",
  // Agency: $299/mo (LLM Rank Agency) — LIVE
  price_0Tm0N8ZZhIaYsPbsqhifRi2Q: "agency",
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
