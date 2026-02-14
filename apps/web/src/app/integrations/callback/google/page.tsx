"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";

export default function GoogleOAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { withToken } = useApi();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setError("Missing authorization code or state parameter.");
      return;
    }

    let stateData: { projectId: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      setError("Invalid state parameter.");
      return;
    }

    withToken(async (token) => {
      await api.integrations.oauthCallback(token, {
        code,
        state,
        redirectUri: window.location.origin + "/integrations/callback/google",
      });
      router.replace(
        `/dashboard/projects/${stateData.projectId}?tab=integrations`,
      );
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "OAuth callback failed.");
    });
  }, [searchParams, router, withToken]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-destructive">
            Connection Failed
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="/dashboard/projects"
            className="inline-block text-sm text-primary underline"
          >
            Return to projects
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">
          Connecting your Google account...
        </p>
      </div>
    </div>
  );
}
