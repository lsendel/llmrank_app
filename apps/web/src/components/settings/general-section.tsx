"use client";

import {
  ClearHistoryCard,
  CurrentPlanCard,
  DangerZoneCard,
  EmailDigestCard,
  NotificationPreferencesCard,
  RoleCard,
  WebhookUrlCard,
} from "./general-section-sections";
import { useGeneralSectionActions } from "./use-general-section-actions";
import { useGeneralSectionData } from "./use-general-section-data";

export function GeneralSection() {
  const {
    me,
    planName,
    notifications,
    mutateNotifications,
    digestPrefs,
    mutateDigest,
    projectsList,
  } = useGeneralSectionData();
  const {
    savingNotification,
    savingDigest,
    deleteDialogOpen,
    deleting,
    webhookInput,
    savingWebhook,
    webhookError,
    webhookSuccess,
    persona,
    savingPersona,
    clearTarget,
    clearDialogOpen,
    clearing,
    clearResult,
    setDeleteDialogOpen,
    setClearTarget,
    setClearDialogOpen,
    handlePersonaChange,
    handleToggleNotification,
    handleDigestFrequencyChange,
    handleDigestDayChange,
    handleWebhookInputChange,
    handleSaveWebhook,
    handleRemoveWebhook,
    handleClearHistory,
    handleDeleteAccount,
  } = useGeneralSectionActions({
    mePersona: me?.persona,
    notifications,
    mutateNotifications,
    mutateDigest,
    projectsList,
  });

  return (
    <div className="space-y-8 pt-4">
      <CurrentPlanCard planName={planName} />
      <RoleCard
        persona={persona}
        savingPersona={savingPersona}
        onPersonaChange={handlePersonaChange}
      />
      <NotificationPreferencesCard
        notifications={notifications}
        savingNotification={savingNotification}
        onToggleNotification={handleToggleNotification}
      />
      <EmailDigestCard
        digestPrefs={digestPrefs}
        savingDigest={savingDigest}
        onDigestFrequencyChange={handleDigestFrequencyChange}
        onDigestDayChange={handleDigestDayChange}
      />
      <WebhookUrlCard
        webhookInput={webhookInput}
        savingWebhook={savingWebhook}
        webhookError={webhookError}
        webhookSuccess={webhookSuccess}
        hasWebhook={Boolean(notifications?.webhookUrl)}
        onWebhookInputChange={handleWebhookInputChange}
        onSaveWebhook={handleSaveWebhook}
        onRemoveWebhook={handleRemoveWebhook}
      />
      <ClearHistoryCard
        clearTarget={clearTarget}
        onClearTargetChange={setClearTarget}
        clearDialogOpen={clearDialogOpen}
        onClearDialogOpenChange={setClearDialogOpen}
        clearing={clearing}
        clearResult={clearResult}
        projectsList={projectsList}
        onClearHistory={handleClearHistory}
      />
      <DangerZoneCard
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        deleting={deleting}
        onDeleteAccount={handleDeleteAccount}
      />
    </div>
  );
}
