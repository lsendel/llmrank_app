"use client";

import { useState } from "react";
import { Globe, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api";

export function SiteContextSection({ projectId }: { projectId: string }) {
  const { data: project, mutate } = useProject(projectId);
  const { toast } = useToast();

  const [siteDescription, setSiteDescription] = useState(
    project?.siteDescription ?? "",
  );
  const [industry, setIndustry] = useState(project?.industry ?? "");
  const [saving, setSaving] = useState(false);
  const [rediscovering, setRediscovering] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.projects.updateSiteContext(projectId, {
        siteDescription,
        industry,
      });
      await mutate();
      toast({ title: "Site context saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRediscoverCompetitors() {
    setRediscovering(true);
    try {
      await api.projects.rediscoverCompetitors(projectId);
      toast({
        title: "Discovering competitors...",
        description:
          "This may take a minute. Check the Competitors tab shortly.",
      });
    } catch {
      toast({ title: "Failed to start discovery", variant: "destructive" });
    } finally {
      setRediscovering(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Site Context
        </CardTitle>
        <CardDescription>
          Auto-detected from your crawl data. Edit if incorrect to improve
          competitor discovery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="site-description">Site Description</Label>
          <Textarea
            id="site-description"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder="What does your site or product do?"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g., Project Management, E-commerce, Healthcare"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRediscoverCompetitors}
            disabled={rediscovering}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${rediscovering ? "animate-spin" : ""}`}
            />
            {rediscovering ? "Discovering..." : "Re-discover Competitors"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
