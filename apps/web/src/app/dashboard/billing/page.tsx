"use client";

import {
  BillingAvailablePlansCard,
  BillingCurrentPlanCard,
  BillingDowngradeDialog,
  BillingPageHeader,
  BillingPaymentHistoryCard,
  BillingSubscriptionManagementCard,
  BillingSuccessBanner,
  BillingVerifyingUpgradeState,
  BillingWorkflowCard,
} from "./_components/billing-page-sections";
import { useBillingPageState } from "./_hooks/use-billing-page-state";

export default function BillingPage() {
  const {
    billing,
    subscription,
    payments,
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
    dismissSuccessBanner,
  } = useBillingPageState();

  if (verifyingUpgrade) {
    return <BillingVerifyingUpgradeState />;
  }

  return (
    <div className="space-y-8">
      {successBanner ? (
        <BillingSuccessBanner
          message={successBanner}
          onDismiss={dismissSuccessBanner}
        />
      ) : null}

      <BillingPageHeader />
      <BillingWorkflowCard />

      <BillingCurrentPlanCard
        currentPlanName={currentPlanName}
        currentTier={currentTier}
        currentPlanPrice={currentPlanPrice}
        subscription={subscription}
        creditsRemaining={creditsRemaining}
        crawlsTotal={crawlsTotal}
        creditsPercentUsed={creditsPercentUsed}
        crawlsUsed={crawlsUsed}
        maxProjects={billing?.maxProjects}
        maxPagesPerCrawl={billing?.maxPagesPerCrawl}
        nextPlanTier={nextPlanTier}
        onUpgradePlan={() => {
          if (nextPlanTier) {
            void handlePlanAction(nextPlanTier);
          }
        }}
      />

      <BillingSubscriptionManagementCard
        subscription={subscription}
        currentTier={currentTier}
        nextPlanTier={nextPlanTier}
        portalLoading={portalLoading}
        cancelDialogOpen={cancelDialogOpen}
        canceling={canceling}
        onOpenPortal={() => {
          void handleOpenPortal();
        }}
        onCancelDialogOpenChange={setCancelDialogOpen}
        onCancelSubscription={() => {
          void handleCancelSubscription();
        }}
        onChoosePlan={() => {
          if (nextPlanTier) {
            void handlePlanAction(nextPlanTier);
          }
        }}
      />

      <BillingAvailablePlansCard
        currentTier={currentTier}
        upgrading={upgrading}
        promoCode={promoCode}
        promoValid={promoValid}
        promoError={promoError}
        validatingPromo={validatingPromo}
        onPlanAction={(planTier) => {
          void handlePlanAction(planTier);
        }}
        onPromoCodeChange={handlePromoCodeChange}
        onValidatePromo={() => {
          void handleValidatePromo();
        }}
      />

      <BillingDowngradeDialog
        open={downgradeDialogOpen}
        downgradingTo={downgradingTo}
        canceling={canceling}
        downgrading={downgrading}
        onOpenChange={handleDowngradeDialogOpenChange}
        onConfirm={() => {
          void handleDowngradeConfirmation();
        }}
      />

      <BillingPaymentHistoryCard
        payments={payments}
        onOpenPortal={() => {
          void handleOpenPortal();
        }}
      />
    </div>
  );
}
