import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Sign Out | LLM Rank",
  description: "Signs the current user out of LLM Rank.",
});

export default function SignOutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
