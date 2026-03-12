"use client";

import Script from "next/script";

const CF_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

export function CloudflareAnalytics() {
  if (!CF_TOKEN) return null;

  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={`{"token": "${CF_TOKEN}"}`}
      strategy="afterInteractive"
    />
  );
}
