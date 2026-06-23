import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Connect Indices",
  description:
    "Utility page used to complete the Indices integration handshake.",
});

export default function ConnectIndicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
