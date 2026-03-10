"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state";
import { api, ApiError, type SharedReport } from "@/lib/api";
import { ReportPageLayout } from "./_components/report-page-sections";

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailCaptured, setEmailCaptured] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`report-unlocked-${params.token}`) === "true";
    }

    return false;
  });

  useEffect(() => {
    api.public
      .getReport(params.token)
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Report not found or sharing has been disabled.");
        }
      })
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <StateMessage
        variant="loading"
        title="Loading report"
        description="Preparing shared score summary, actions, and page details."
        className="min-h-screen"
      />
    );
  }

  if (error || !report) {
    return (
      <StateMessage
        variant="error"
        title="Report unavailable"
        description={error ?? "Report not found."}
        className="min-h-screen"
        action={
          <Button asChild>
            <Link href="/scan">Scan Your Site Free</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ReportPageLayout
      report={report}
      reportToken={params.token}
      emailCaptured={emailCaptured}
      onEmailCaptured={() => setEmailCaptured(true)}
    />
  );
}
