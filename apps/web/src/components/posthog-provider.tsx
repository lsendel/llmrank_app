"use client";

import { useEffect } from "react";
import { initTelemetry } from "@/lib/telemetry";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (apiKey) {
      initTelemetry(apiKey, process.env.NEXT_PUBLIC_POSTHOG_HOST);
    }
  }, []);

  return <>{children}</>;
}
