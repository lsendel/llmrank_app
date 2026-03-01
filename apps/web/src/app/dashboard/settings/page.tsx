"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSection } from "@/components/settings/general-section";
import { BrandingSection } from "@/components/settings/branding-section";
import { NotificationChannelsSection } from "@/components/settings/notification-channels-section";
import { ApiTokensSection } from "@/components/settings/api-tokens-section";
import { DigestPreferencesSection } from "@/components/settings/digest-preferences-section";
import { apiUrl } from "@/lib/api-base-url";
import { StateMessage } from "@/components/ui/state";
import { extractOrgIdFromPayload } from "./org-response";
import { DEFAULT_SETTINGS_TAB, normalizeSettingsTab } from "./tab-state";

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

export default function SettingsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgResolved, setOrgResolved] = useState(false);
  const [orgLoadError, setOrgLoadError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const hasOrganizationAccess = orgResolved ? Boolean(orgId) : true;
  const activeTab = normalizeSettingsTab(rawTab, hasOrganizationAccess);

  const loadOrganization = useCallback((reset = false) => {
    if (reset) {
      setOrgResolved(false);
      setOrgLoadError(false);
    }
    return fetch(apiUrl("/api/orgs"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        setOrgId(extractOrgIdFromPayload(json));
        setOrgLoadError(false);
      })
      .catch(() => {
        setOrgLoadError(true);
        setOrgId(null);
      })
      .finally(() => setOrgResolved(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrganization();
  }, [loadOrganization]);

  useEffect(() => {
    if (!rawTab || !orgResolved) return;
    if (rawTab === activeTab) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (activeTab === DEFAULT_SETTINGS_TAB) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", activeTab);
    }

    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [activeTab, orgResolved, pathname, rawTab, router, searchParams]);

  function handleTabChange(value: string) {
    const nextTab = normalizeSettingsTab(value, Boolean(orgId));
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextTab === DEFAULT_SETTINGS_TAB) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }

    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

      {orgLoadError && (
        <StateMessage
          variant="error"
          compact
          title="Could not load organization settings"
          description="Team, SSO, and audit tabs may be limited until this is resolved."
          retry={{ onClick: () => void loadOrganization(true) }}
        />
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api-tokens">API Tokens</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          {orgId && <TabsTrigger value="sso">SSO</TabsTrigger>}
          {orgId && <TabsTrigger value="audit-log">Audit Log</TabsTrigger>}
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
    </div>
  );
}
