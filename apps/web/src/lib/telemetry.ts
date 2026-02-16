import posthog from "posthog-js";

let initialized = false;

export function initTelemetry(apiKey: string, apiHost?: string) {
  if (initialized || typeof window === "undefined") return;
  posthog.init(apiKey, {
    api_host: apiHost ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    loaded: () => {
      initialized = true;
    },
  });
}

export function identify(
  userId: string,
  traits: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.identify(userId, traits);
}

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

export function page(name: string): void {
  if (typeof window === "undefined") return;
  posthog.capture("$pageview", { page_name: name });
}

export function reset(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
}

export function getFeatureFlag(key: string): boolean | string | undefined {
  if (typeof window === "undefined") return undefined;
  return posthog.getFeatureFlag(key);
}
