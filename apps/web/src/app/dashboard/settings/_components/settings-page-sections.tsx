import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSection } from "@/components/settings/general-section";
import { BrandingSection } from "@/components/settings/branding-section";
import { NotificationChannelsSection } from "@/components/settings/notification-channels-section";
import { ApiTokensSection } from "@/components/settings/api-tokens-section";
import { DigestPreferencesSection } from "@/components/settings/digest-preferences-section";
import { StateMessage } from "@/components/ui/state";
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";
import type { SettingsTab } from "../tab-state";
import {
  getSettingsWorkflowActions,
  getVisibleSettingsTabs,
  SETTINGS_WORKFLOW_STEPS,
} from "../settings-page-helpers";

const TeamSection = dynamic(
  () =>
    import("@/components/settings/team-section").then((m) => ({
      default: m.TeamSection,
    })),
  {
    loading: () => (
      <StateMessage
        variant="loading"
        title="Loading team settings"
        compact
        className="py-8"
      />
    ),
  },
);

const SsoConfiguration = dynamic(
  () =>
    import("@/components/settings/sso-configuration").then((m) => ({
      default: m.SsoConfiguration,
    })),
  {
    loading: () => (
      <StateMessage
        variant="loading"
        title="Loading SSO settings"
        compact
        className="py-8"
      />
    ),
  },
);

const AuditLogSection = dynamic(
  () =>
    import("@/components/settings/audit-log-section").then((m) => ({
      default: m.AuditLogSection,
    })),
  {
    loading: () => (
      <StateMessage
        variant="loading"
        title="Loading audit log"
        compact
        className="py-8"
      />
    ),
  },
);

export function SettingsPageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your account, plan, and notification preferences.
      </p>
    </div>
  );
}

export function SettingsWorkflowCard({ orgId }: { orgId: string | null }) {
  return (
    <WorkflowGuidance
      title="Settings workflow"
      description="Apply defaults once, keep team access controlled, and automate communication."
      actions={getSettingsWorkflowActions(orgId)}
      steps={SETTINGS_WORKFLOW_STEPS}
    />
  );
}

export function SettingsOrgError({
  show,
  onRetry,
}: {
  show: boolean;
  onRetry: () => void;
}) {
  if (!show) return null;

  return (
    <StateMessage
      variant="error"
      compact
      title="Could not load organization settings"
      description="Team, SSO, and audit tabs may be limited until this is resolved."
      retry={{ onClick: onRetry }}
    />
  );
}

export function SettingsTabsShell({
  activeTab,
  onTabChange,
  orgId,
}: {
  activeTab: SettingsTab;
  onTabChange: (value: string) => void;
  orgId: string | null;
}) {
  const visibleTabs = getVisibleSettingsTabs(orgId);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general" className="space-y-8">
        <GeneralSection />
      </TabsContent>

      <TabsContent value="branding">
        <BrandingSection />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <NotificationChannelsSection />
        <DigestPreferencesSection />
      </TabsContent>

      <TabsContent value="api-tokens" className="space-y-6">
        <ApiTokensSection />
      </TabsContent>

      <TabsContent value="team" className="space-y-6">
        <TeamSection />
      </TabsContent>

      {orgId && (
        <TabsContent value="sso" className="space-y-6">
          <SsoConfiguration orgId={orgId} />
        </TabsContent>
      )}

      {orgId && (
        <TabsContent value="audit-log" className="space-y-6">
          <AuditLogSection orgId={orgId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
