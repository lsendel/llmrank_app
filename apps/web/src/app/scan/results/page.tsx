"use client";

import { Suspense } from "react";
import {
  ScanResultsErrorState,
  ScanResultsLoadingState,
  ScanResultsReport,
} from "./_components/scan-results-sections";
import { useScanResultsState } from "./_hooks/use-scan-results-state";

function ScanResultsContent() {
  const state = useScanResultsState();

  if (state.loading) {
    return <ScanResultsLoadingState />;
  }

  if (state.error) {
    return <ScanResultsErrorState error={state.error} />;
  }

  if (!state.result) {
    return <ScanResultsLoadingState />;
  }

  return (
    <ScanResultsReport
      result={state.result}
      scanId={state.scanId}
      isUnlocked={state.isUnlocked}
      isSignedIn={state.isSignedIn}
      creatingWorkspace={state.creatingWorkspace}
      workspaceError={state.workspaceError}
      recurringScanDestination={state.recurringScanDestination}
      pagesSampled={state.pagesSampled}
      sampleConfidence={state.sampleConfidence}
      visibilityChecks={state.visibilityChecks}
      visibilityProviders={state.visibilityProviders}
      anyVisibilityMention={state.anyVisibilityMention}
      onTrackCta={state.trackCtaClick}
      onEmailCaptured={state.handleEmailCaptured}
      onCreateWorkspace={state.handleCreateWorkspaceFromScan}
    />
  );
}

export default function ScanResultsPage() {
  return (
    <Suspense fallback={<ScanResultsLoadingState />}>
      <ScanResultsContent />
    </Suspense>
  );
}
