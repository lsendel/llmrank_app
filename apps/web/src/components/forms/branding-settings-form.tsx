"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";

interface BrandingSettingsFormProps {
  projectId: string;
  initialBranding?: {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
  };
}

export function BrandingSettingsForm({
  projectId,
  initialBranding,
}: BrandingSettingsFormProps) {
  const { withToken } = useApi();
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState(
    initialBranding ?? {
      logoUrl: "",
      companyName: "",
      primaryColor: "",
    },
  );

  async function handleSave() {
    setLoading(true);
    try {
      await withToken((token) =>
        api.projects.update(token, projectId, { branding }),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Branding</CardTitle>
        <CardDescription>
          Customize the appearance of your PDF reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Agency / Company Name</Label>
          <Input
            id="companyName"
            value={branding.companyName ?? ""}
            onChange={(e) =>
              setBranding({ ...branding, companyName: e.target.value })
            }
            placeholder="Acme SEO Agency"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            value={branding.logoUrl ?? ""}
            onChange={(e) =>
              setBranding({ ...branding, logoUrl: e.target.value })
            }
            placeholder="https://example.com/logo.png"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryColor">Primary Brand Color (Hex)</Label>
          <div className="flex gap-2">
            <Input
              id="primaryColor"
              value={branding.primaryColor ?? ""}
              onChange={(e) =>
                setBranding({ ...branding, primaryColor: e.target.value })
              }
              placeholder="#6366f1"
              className="font-mono"
            />
            <div
              className="h-10 w-10 shrink-0 rounded-md border"
              style={{ backgroundColor: branding.primaryColor || "#6366f1" }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Branding"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
