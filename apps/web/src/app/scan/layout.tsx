import type { Metadata } from "next";
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Free AI-Readiness Scan",
  description:
    "Enter any URL to get an instant AI-readiness score with actionable recommendations. No signup required. Powered by LLM Boost's 37-factor scoring engine.",
  alternates: { canonical: "/scan" },
  openGraph: {
    title: "Free AI-Readiness Scan | LLM Boost",
    description:
      "Enter any URL to get an instant AI-readiness score. No signup required.",
    url: "https://llmrank.app/scan",
  },
};

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
