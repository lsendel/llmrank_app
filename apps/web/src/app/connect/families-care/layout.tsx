import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Connect Families.care",
  description:
    "Utility page used to complete the Families.care integration handshake.",
});

export default function ConnectFamiliesCareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
