import type { Metadata } from "next";

const BASE_URL = "https://llmrank.app";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.png`;

type PublicMetadataInput = {
  title: string;
  description: string;
  path: string;
  openGraphTitle?: string;
  openGraphDescription?: string;
  keywords?: string[];
};

export function buildPublicMetadata({
  title,
  description,
  path,
  openGraphTitle,
  openGraphDescription,
  keywords,
}: PublicMetadataInput): Metadata {
  const url = path === "/" ? BASE_URL : `${BASE_URL}${path}`;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: openGraphTitle ?? title,
      description: openGraphDescription ?? description,
      url,
      siteName: "LLM Rank",
      type: "website",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: "LLM Rank — AI-Readiness SEO Platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: openGraphTitle ?? title,
      description: openGraphDescription ?? description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

type UtilityMetadataInput = {
  title: string;
  description: string;
};

export function buildNoIndexMetadata({
  title,
  description,
}: UtilityMetadataInput): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  };
}
