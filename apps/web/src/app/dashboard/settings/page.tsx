"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSection } from "@/components/settings/general-section";
import { BrandingSection } from "@/components/settings/branding-section";
import { NotificationChannelsSection } from "@/components/settings/notification-channels-section";
import { ApiTokensSection } from "@/components/settings/api-tokens-section";
import { DigestPreferencesSection } from "@/components/settings/digest-preferences-section";
import { extractOrgIdFromPayload } from "./org-response";

const TeamSection = dynamic(
  () =>
    import("@/components/settings/team-section").then((m) => ({
      default: m.TeamSection,
    })),
  {
    loading: () => (
      <p className="py-8 text-center text-muted-foreground">
        Loading team settings...
      </p>
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
      <p className="py-8 text-center text-muted-foreground">
        Loading SSO settings...
      </p>
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
      <p className="py-8 text-center text-muted-foreground">
        Loading audit log...
      </p>
    ),
  },
);

export default function SettingsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
    fetch(`${baseUrl}/api/orgs`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        setOrgId(extractOrgIdFromPayload(json));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
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
