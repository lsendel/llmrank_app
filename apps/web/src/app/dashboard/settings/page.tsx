"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CheckCircle2, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type BillingInfo } from "@/lib/api";
import { GeneralSection } from "@/components/settings/general-section";
import { BillingSection } from "@/components/settings/billing-section";
import { BrandingSection } from "@/components/settings/branding-section";
import { NotificationChannelsSection } from "@/components/settings/notification-channels-section";
import { ApiTokensSection } from "@/components/settings/api-tokens-section";
import { DigestPreferencesSection } from "@/components/settings/digest-preferences-section";

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
  const searchParams = useSearchParams();

  const { isLoading: loading } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );

  const [successBanner, setSuccessBanner] = useState<string | null>(() => {
    if (searchParams.get("upgraded") === "true") {
      // Clean URL without triggering navigation
      window.history.replaceState({}, "", "/dashboard/settings");
      return "Your plan has been upgraded successfully! Your new features are now active.";
    }
    return null;
  });

  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
    fetch(`${baseUrl}/api/orgs`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const orgs = json?.data;
        if (Array.isArray(orgs) && orgs.length > 0) setOrgId(orgs[0].id);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Success banner after upgrade */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{successBanner}</p>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-green-600 hover:text-green-800 dark:text-green-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api-tokens">API Tokens</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          {orgId && <TabsTrigger value="sso">SSO</TabsTrigger>}
          {orgId && <TabsTrigger value="audit-log">Audit Log</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          <GeneralSection />
          <DigestPreferencesSection />
        </TabsContent>

        <TabsContent value="billing" className="space-y-8">
          <BillingSection />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSection />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationChannelsSection />
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
