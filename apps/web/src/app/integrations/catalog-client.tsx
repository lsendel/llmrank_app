"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { canAccessIntegration, type PlanTier } from "@llm-boost/shared";
import { useUser } from "@/lib/auth-hooks";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type BillingInfo, type IntegrationCatalogItem } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IntegrationCatalogClient() {
  const { isSignedIn } = useUser();
  const { data: catalog } = useApiSWR<IntegrationCatalogItem[]>(
    "integration-catalog",
    useCallback(() => api.public.integrationCatalog(), []),
  );

  const { data: billing } = useApiSWR<BillingInfo>(
    isSignedIn ? "billing-info" : null,
    useCallback(() => api.billing.getInfo(), []),
  );

  const { data: projectsPage } = useApiSWR(
    isSignedIn ? "integrations-projects-page" : null,
    useCallback(() => api.projects.list({ page: 1, limit: 100 }), []),
  );

  const projects = projectsPage?.data ?? [];
  const firstProjectId = projects.length > 0 ? projects[0].id : "";
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const effectiveProjectId = selectedProjectId || firstProjectId;

  const { data: projectIntegrations } = useApiSWR(
    isSignedIn && effectiveProjectId
      ? `integrations-catalog-${effectiveProjectId}`
      : null,
    useCallback(
      () => api.integrations.list(effectiveProjectId),
      [effectiveProjectId],
    ),
  );

  const connectedProviders = useMemo(
    () =>
      new Set(
        (projectIntegrations ?? [])
          .filter(
            (integration) => integration.hasCredentials && integration.enabled,
          )
          .map((integration) => integration.provider),
      ),
    [projectIntegrations],
  );

  const currentPlan = (billing?.plan ?? "free") as PlanTier;

  function trackConnectClick(
    provider: "gsc" | "ga4" | "mcp" | "wordpress" | "slack",
    destination: string,
    state: "signed_out" | "needs_project" | "upgrade_required" | "ready",
  ) {
    track("integration_connect_clicked", {
      provider,
      destination,
      source: "integrations_catalog",
      state,
      projectId: effectiveProjectId || "none",
    });
  }

  if (!catalog) {
    return (
      <p className="text-sm text-muted-foreground">Loading integrations...</p>
    );
  }

  return (
    <div className="space-y-6">
      {isSignedIn && projects.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <label htmlFor="integration-project" className="text-sm font-medium">
            Project
          </label>
          <select
            id="integration-project"
            value={effectiveProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Actions below apply to the selected project.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {catalog.map((integration) => {
          const isComingSoon = integration.availability === "coming_soon";
          const requiresAuth = integration.access === "requires_auth";
          const isConnected =
            integration.provider !== null &&
            connectedProviders.has(integration.provider);

          const planAllows =
            integration.provider !== null
              ? canAccessIntegration(currentPlan, integration.provider)
              : true;

          let buttonLabel = "View Setup Guide";
          let buttonHref = integration.link ?? "/mcp";
          let buttonDisabled = false;
          let buttonVariant: "default" | "outline" = "default";
          let clickState:
            | "signed_out"
            | "needs_project"
            | "upgrade_required"
            | "ready" = "ready";

          if (isComingSoon) {
            buttonLabel = "Coming Soon";
            buttonHref = "";
            buttonDisabled = true;
            buttonVariant = "outline";
          } else if (requiresAuth && !isSignedIn) {
            buttonLabel = "Sign In to Connect";
            buttonHref = "/sign-in";
            clickState = "signed_out";
          } else if (requiresAuth && isSignedIn && projects.length === 0) {
            buttonLabel = "Create a Project";
            buttonHref = "/dashboard/projects/new";
            clickState = "needs_project";
          } else if (
            integration.provider &&
            isConnected &&
            effectiveProjectId
          ) {
            buttonLabel = "Connected";
            buttonHref = `/dashboard/projects/${effectiveProjectId}?tab=integrations`;
            buttonVariant = "outline";
          } else if (integration.provider && effectiveProjectId) {
            if (!planAllows) {
              buttonLabel =
                integration.minPlan === "agency"
                  ? "Upgrade to Agency"
                  : "Upgrade to Pro";
              buttonHref = "/pricing";
              buttonVariant = "outline";
              clickState = "upgrade_required";
            } else {
              buttonLabel = "Connect";
              buttonHref = `/dashboard/projects/${effectiveProjectId}?tab=integrations&connect=${integration.provider}`;
            }
          }

          return (
            <Card key={integration.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">{integration.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isComingSoon
                          ? "bg-muted text-muted-foreground"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {isComingSoon ? "Coming Soon" : "Available Now"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        requiresAuth
                          ? "bg-warning/10 text-warning"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {requiresAuth ? "Requires Auth" : "Public"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="mb-4 text-muted-foreground">
                  {integration.description}
                </p>
                <ul className="mb-6 flex-1 space-y-2">
                  {integration.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {buttonDisabled ? (
                  <Button variant={buttonVariant} disabled className="w-full">
                    {buttonLabel}
                  </Button>
                ) : (
                  <Button variant={buttonVariant} asChild className="w-full">
                    <Link
                      href={buttonHref}
                      onClick={() =>
                        trackConnectClick(
                          (integration.provider ?? integration.id) as
                            | "gsc"
                            | "ga4"
                            | "mcp"
                            | "wordpress"
                            | "slack",
                          buttonHref,
                          clickState,
                        )
                      }
                    >
                      {buttonLabel}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
