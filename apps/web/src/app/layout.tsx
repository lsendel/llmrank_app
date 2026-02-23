import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PostHogProvider } from "@/components/posthog-provider";
import { GoogleAnalytics } from "@/components/google-analytics";
import { MicrosoftClarity } from "@/components/microsoft-clarity";
import { Intercom } from "@/components/intercom";
import {
  JsonLd,
  organizationSchema,
  webSiteSchema,
} from "@/components/seo/json-ld";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const BASE_URL = "https://llmrank.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:
      "AI Search Optimization Tool - Rank in ChatGPT & Perplexity | LLM Rank",
    template: "%s | LLM Rank",
  },
  description:
    "The first AI Search Optimization (AISO) platform. Audit your website for AI-readiness across 37 factors. Optimize for ChatGPT, Claude, Perplexity, and Gemini.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "LLM Rank",
    title: "Rank in ChatGPT, Claude & Perplexity | LLM Rank",
    description:
      "Audit your website for AI-readiness across 37 factors. Improve visibility in ChatGPT, Claude, Perplexity, and Gemini.",
    url: BASE_URL,
    images: [
      {
        url: `${BASE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: "LLM Rank — AI-Readiness SEO Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Search Optimization Tool - Rank in ChatGPT & Perplexity",
    description:
      "Audit your website for AI-readiness across 37 factors. Improve visibility in ChatGPT, Claude, Perplexity, and Gemini.",
    images: [`${BASE_URL}/og-default.png`],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
        <PostHogProvider>{children}</PostHogProvider>
        <GoogleAnalytics />
        <MicrosoftClarity />
        <Intercom />
      </body>
    </html>
  );
}
