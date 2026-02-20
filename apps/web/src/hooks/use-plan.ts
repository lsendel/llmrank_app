"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

export function usePlan() {
  const { data } = useApiSWR(
    "billing-usage",
    useCallback(() => api.billing.getInfo(), []),
  );

  const plan = data?.plan ?? "free";
  return {
    plan,
    isFree: plan === "free",
    isStarter: plan === "starter",
    isPro: plan === "pro",
    isAgency: plan === "agency",
    isPaid: plan !== "free",
    isProOrAbove: plan === "pro" || plan === "agency",
  };
}
