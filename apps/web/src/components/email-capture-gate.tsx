"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";

interface EmailCaptureGateProps {
  reportToken?: string;
  scanResultId?: string;
  onCaptured: (leadId: string) => void;
}

export function EmailCaptureGate({
  reportToken,
  scanResultId,
  onCaptured,
}: EmailCaptureGateProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedEmail = email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const lead = await api.public.captureLead({
        email: trimmedEmail,
        reportToken,
        scanResultId,
      });
      if (reportToken) {
        localStorage.setItem(`report-unlocked-${reportToken}`, "true");
      }
      track("scan.email_captured", {
        domain: reportToken ?? scanResultId ?? "unknown",
      });
      onCaptured(lead.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-lg">Unlock the Full Report</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Enter your email to access detailed Quick Wins, page-by-page analysis,
          and actionable recommendations.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting || !trimmedEmail}>
            {submitting ? "..." : "Unlock"}
          </Button>
        </form>
        {!error && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Use a work email so we can send the PDF summary and unlock every
            quick win instantly.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive text-center mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
