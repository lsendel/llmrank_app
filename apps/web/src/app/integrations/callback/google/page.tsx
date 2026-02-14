"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";

function GoogleOAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { withToken } = useApi();
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const [error, setError] = useState<string | null>(null);

  const stateData = stateParam
    ? (() => {
        try {
          return JSON.parse(atob(stateParam)) as { projectId: string };
        } catch {
          return null;
        }
      })()
    : null;

  useEffect(() => {
    if (!code || !stateParam || !stateData) return;
    let cancelled = false;

    withToken(async (token) => {
      await api.integrations.oauthCallback(token, {
        code,
        state: stateParam,
        redirectUri: window.location.origin + "/integrations/callback/google",
      });
      if (!cancelled) {
        router.replace(
          `/dashboard/projects/${stateData.projectId}?tab=integrations`,
        );
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "OAuth callback failed.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, stateParam, stateData, router, withToken]);

  if (!code || !stateParam) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-destructive">
            Connection Failed
          </h1>
          <p className="text-sm text-muted-foreground">
            Missing authorization code or state parameter.
          </p>
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

  if (stateParam && !stateData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-destructive">
            Connection Failed
          </h1>
          <p className="text-sm text-muted-foreground">
            Invalid state parameter.
          </p>
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

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <GoogleOAuthCallback />
    </Suspense>
  );
}
