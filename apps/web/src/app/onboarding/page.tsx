"use client";

import { useOnboardingWizard } from "@/hooks/use-onboarding-wizard";
import {
  OnboardingLoadingState,
  OnboardingWizardCard,
} from "./_components/onboarding-page-sections";
import { ONBOARDING_TIPS } from "./onboarding-page-helpers";

export default function OnboardingPage() {
  const {
    state,
    dispatch,
    isLoaded,
    isSignedIn,
    handleContinue,
    handleDomainChange,
    handleStartScan,
    handleRetry,
    router,
  } = useOnboardingWizard(ONBOARDING_TIPS.length);

  if (!isLoaded || !state.guardChecked) {
    return <OnboardingLoadingState />;
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <OnboardingWizardCard
      state={state}
      dispatch={dispatch}
      onContinue={handleContinue}
      onDomainChange={handleDomainChange}
      onStartScan={handleStartScan}
      onRetry={handleRetry}
      onViewReport={() => {
        if (state.crawlId) {
          router.push(`/dashboard/crawl/${state.crawlId}`);
        }
      }}
    />
  );
}
