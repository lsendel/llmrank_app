import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  type BillingInfo,
  type PaymentRecord,
  type PromoInfo,
  type SubscriptionInfo,
} from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  BILLING_PLANS,
  BILLING_PLAN_NAME_MAP,
  BILLING_PLAN_PRICE_MAP,
  buildBillingUpgradeUrls,
  getNextBillingPlanTier,
  type BillingPlanTier,
} from "../billing-page-helpers";

export function useBillingPageState() {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: billing, mutate: mutateBilling } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: subscription, mutate: mutateSubscription } =
    useApiSWR<SubscriptionInfo | null>(
      "billing-subscription",
      useCallback(() => api.billing.getSubscription(), []),
    );
  const { data: payments } = useApiSWR<PaymentRecord[]>(
    "billing-payments",
    useCallback(() => api.billing.getPayments(), []),
  );

  const [upgrading, setUpgrading] = useState<BillingPlanTier | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [downgradingTo, setDowngradingTo] = useState<BillingPlanTier | null>(
    null,
  );
  const [downgrading, setDowngrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoValid, setPromoValid] = useState<PromoInfo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [verifyingUpgrade, setVerifyingUpgrade] = useState(false);
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (
      searchParams.get("upgraded") !== "true" ||
      verificationStarted.current
    ) {
      return;
    }

    verificationStarted.current = true;
    setVerifyingUpgrade(true);

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const freshBilling = await api.billing.getInfo();
        if (freshBilling.plan !== "free" || attempts >= 5) {
          await mutateBilling();
          await mutateSubscription();
          setVerifyingUpgrade(false);
          setSuccessBanner("Your plan has been upgraded successfully!");
          router.replace("/dashboard/billing", { scroll: false });
          return;
        }
      } catch {
        // ignore error and let it retry
      }

      attempts += 1;
      if (attempts < 5) {
        timeoutId = setTimeout(poll, 2000);
      } else {
        setVerifyingUpgrade(false);
        setSuccessBanner(
          "Your payment was received. It may take a minute for your new plan to show up.",
        );
        router.replace("/dashboard/billing", { scroll: false });
      }
    };

    timeoutId = setTimeout(poll, 1500);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [mutateBilling, mutateSubscription, router, searchParams]);

  const currentTier: BillingPlanTier = billing?.plan ?? "free";
  const currentPlanName = BILLING_PLAN_NAME_MAP[currentTier] ?? "Free";
  const currentPlanPrice = BILLING_PLAN_PRICE_MAP[currentTier] ?? 0;
  const crawlsTotal = billing?.crawlCreditsTotal ?? 0;
  const creditsRemaining = Math.min(
    billing?.crawlCreditsRemaining ?? 0,
    crawlsTotal,
  );
  const crawlsUsed = Math.max(0, crawlsTotal - creditsRemaining);
  const creditsPercentUsed =
    crawlsTotal > 0 ? Math.min(100, (crawlsUsed / crawlsTotal) * 100) : 0;
  const nextPlanTier = getNextBillingPlanTier(currentTier);

  const handleOpenPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      await withAuth(async () => {
        const result = await api.billing.createPortalSession(
          window.location.href,
        );
        window.location.href = result.url;
      });
    } catch {
      toast({
        title: "No payment history available",
        description:
          "Payment history is available after your first subscription. Upgrade to get started.",
        variant: "destructive",
      });
      setPortalLoading(false);
    }
  }, [toast, withAuth]);

  const handleCancelSubscription = useCallback(async () => {
    setCanceling(true);
    try {
      await withAuth(async () => {
        await api.billing.cancelSubscription();
      });
      setCancelDialogOpen(false);
      setDowngradeDialogOpen(false);
      await mutateSubscription();
      toast({
        title: "Subscription canceled",
        description: "You'll keep access until the end of your billing period.",
      });
    } catch {
      toast({
        title: "Failed to cancel",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  }, [mutateSubscription, toast, withAuth]);

  const handlePromoCodeChange = useCallback((value: string) => {
    setPromoCode(value);
    setPromoValid(null);
    setPromoError(null);
  }, []);

  const handleValidatePromo = useCallback(async () => {
    if (!promoCode.trim()) {
      return;
    }

    setValidatingPromo(true);
    setPromoError(null);
    try {
      const info = await api.billing.validatePromo(promoCode.trim());
      setPromoValid(info);
    } catch (error) {
      setPromoValid(null);
      setPromoError(
        error instanceof Error ? error.message : "Invalid promo code",
      );
    } finally {
      setValidatingPromo(false);
    }
  }, [promoCode]);

  const handleDowngrade = useCallback(
    async (targetPlan: BillingPlanTier) => {
      setDowngrading(true);
      try {
        await withAuth(async () => {
          await api.billing.downgrade(targetPlan);
        });
        setDowngradeDialogOpen(false);
        setDowngradingTo(null);
        await mutateSubscription();
        toast({
          title: "Plan downgraded",
          description: `Your plan will change to ${BILLING_PLAN_NAME_MAP[targetPlan]} at the next billing cycle.`,
        });
      } catch {
        toast({
          title: "Downgrade failed",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
      } finally {
        setDowngrading(false);
      }
    },
    [mutateSubscription, toast, withAuth],
  );

  const handlePlanAction = useCallback(
    async (planTier: BillingPlanTier) => {
      const currentTierIndex = BILLING_PLANS.findIndex(
        (plan) => plan.tier === currentTier,
      );
      const planIndex = BILLING_PLANS.findIndex(
        (plan) => plan.tier === planTier,
      );
      const isDowngrade = planIndex < currentTierIndex;

      if (isDowngrade) {
        setDowngradingTo(planTier === "free" ? null : planTier);
        setDowngradeDialogOpen(true);
        return;
      }

      setUpgrading(planTier);
      try {
        await withAuth(async () => {
          const { successUrl, cancelUrl } = buildBillingUpgradeUrls(
            window.location.origin,
          );
          const result = await api.billing.upgrade(
            planTier,
            successUrl,
            cancelUrl,
          );
          if (result.method === "checkout" && result.url) {
            window.location.href = result.url;
          } else {
            await mutateSubscription();
            toast({
              title: "Plan upgraded!",
              description: `You're now on the ${BILLING_PLAN_NAME_MAP[planTier]} plan. Prorated charges have been applied.`,
            });
            setUpgrading(null);
          }
        });
      } catch {
        toast({
          title: "Upgrade failed",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
        setUpgrading(null);
      }
    },
    [currentTier, mutateSubscription, toast, withAuth],
  );

  const handleDowngradeDialogOpenChange = useCallback((open: boolean) => {
    setDowngradeDialogOpen(open);
    if (!open) {
      setDowngradingTo(null);
    }
  }, []);

  const handleDowngradeConfirmation = useCallback(async () => {
    if (downgradingTo) {
      await handleDowngrade(downgradingTo);
      return;
    }

    await handleCancelSubscription();
  }, [downgradingTo, handleCancelSubscription, handleDowngrade]);

  return {
    billing,
    subscription: subscription ?? null,
    payments: payments ?? [],
    upgrading,
    cancelDialogOpen,
    downgradeDialogOpen,
    canceling,
    downgradingTo,
    downgrading,
    portalLoading,
    promoCode,
    promoValid,
    promoError,
    validatingPromo,
    successBanner,
    verifyingUpgrade,
    currentTier,
    currentPlanName,
    currentPlanPrice,
    crawlsTotal,
    creditsRemaining,
    crawlsUsed,
    creditsPercentUsed,
    nextPlanTier,
    setCancelDialogOpen,
    handleDowngradeDialogOpenChange,
    handlePromoCodeChange,
    handleOpenPortal,
    handleCancelSubscription,
    handleValidatePromo,
    handlePlanAction,
    handleDowngradeConfirmation,
    dismissSuccessBanner: () => setSuccessBanner(null),
  };
}
