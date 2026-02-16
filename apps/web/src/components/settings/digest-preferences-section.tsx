"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

const FREQUENCY_OPTIONS = [
  { value: "off", label: "Off", description: "No email digests" },
  { value: "weekly", label: "Weekly", description: "Every Monday at 9 AM UTC" },
  {
    value: "monthly",
    label: "Monthly",
    description: "1st of each month at 9 AM UTC",
  },
] as const;

export function DigestPreferencesSection() {
  const { data: me, mutate } = useApiSWR(
    "me",
    useCallback(() => api.account.getMe(), []),
  );
  const [saving, setSaving] = useState(false);
  const [frequency, setFrequency] = useState<string | null>(null);
  const { toast } = useToast();

  const currentFreq = frequency ?? me?.digestFrequency ?? "off";

  async function handleSave() {
    setSaving(true);
    try {
      await api.account.updateProfile({ digestFrequency: currentFreq });
      await mutate();
      toast({ title: "Digest preferences saved" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save preferences";
      toast({
        title: "Failed to save",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email Digests</CardTitle>
        <CardDescription>
          Receive periodic score reports and improvement summaries for all your
          projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                currentFreq === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="digestFrequency"
                value={opt.value}
                checked={currentFreq === opt.value}
                onChange={() => setFrequency(opt.value)}
                className="accent-primary"
              />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
