"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";

interface EmailCaptureGateProps {
  reportToken: string;
  onCaptured: () => void;
}

export function EmailCaptureGate({
  reportToken,
  onCaptured,
}: EmailCaptureGateProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await api.public.captureLead({ email: trimmed, reportToken });
      localStorage.setItem(`report-unlocked-${reportToken}`, "true");
      track("scan.email_captured", { domain: reportToken });
      onCaptured();
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
          <Button type="submit" disabled={submitting || !email.trim()}>
            {submitting ? "..." : "Unlock"}
          </Button>
        </form>
        {error && (
          <p className="text-sm text-destructive text-center mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
