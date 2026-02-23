import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing | LLM Rank",
  description: "Manage your subscription, plan, and payment history.",
};

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
