"use client";

import {
  SettingsOrgError,
  SettingsPageHeader,
  SettingsTabsShell,
  SettingsWorkflowCard,
} from "./_components/settings-page-sections";
import { useSettingsPageState } from "./_hooks/use-settings-page-state";

export default function SettingsPage() {
  const {
    activeTab,
    handleTabChange,
    orgId,
    orgLoadError,
    retryLoadOrganization,
  } = useSettingsPageState();

  return (
    <div className="space-y-8">
      <SettingsPageHeader />
      <SettingsWorkflowCard orgId={orgId} />
      <SettingsOrgError show={orgLoadError} onRetry={retryLoadOrganization} />
      <SettingsTabsShell
        activeTab={activeTab}
        onTabChange={handleTabChange}
        orgId={orgId}
      />
    </div>
  );
}
