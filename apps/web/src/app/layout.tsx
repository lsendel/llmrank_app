import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LLM Boost - AI-Readiness SEO Platform",
  description:
    "Optimize your website for AI search engines. Audit, score, and improve your content for LLM visibility.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="min-h-screen font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
