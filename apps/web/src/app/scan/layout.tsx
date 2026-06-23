import type { Metadata } from "next";
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildPublicMetadata({
  title: "Free AI-Readiness Scan",
  description:
    "Enter any URL to get an instant AI-readiness score with actionable recommendations. No signup required. Powered by LLM Rank's 37-factor scoring engine.",
  path: "/scan",
  openGraphTitle: "Free AI-Readiness Scan | LLM Rank",
  openGraphDescription:
    "Enter any URL to get an instant AI-readiness score. No signup required.",
});

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={webPageSchema({
          title: "Free AI-Readiness Scan",
          description:
            "Enter any URL to get an instant AI-readiness score with actionable recommendations.",
          path: "/scan",
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Free Scan", path: "/scan" },
        ])}
      />
      {children}
    </>
  );
}
