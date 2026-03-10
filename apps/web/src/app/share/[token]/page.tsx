import type { Metadata } from "next";
import type { PublicReport } from "@/lib/api";
import {
  SharePageLayout,
  SharePageNotFoundView,
} from "./_components/share-page-sections";
import { buildSharePageMetadata } from "./share-page-helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.llmrank.app";

async function getReport(token: string): Promise<PublicReport | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/reports/${token}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as PublicReport;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const report = await getReport(token);
  if (!report) return { title: "Report Not Found" };

  return buildSharePageMetadata(report);
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const report = await getReport(token);

  if (!report) {
    return <SharePageNotFoundView />;
  }

  return <SharePageLayout report={report} />;
}
