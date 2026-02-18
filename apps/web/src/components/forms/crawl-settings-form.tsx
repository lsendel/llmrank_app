"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

interface CrawlSettingsFormProps {
  projectId: string;
  initialSettings?: {
    ignoreRobots?: boolean;
  };
}

export function CrawlSettingsForm({
  projectId,
  initialSettings,
}: CrawlSettingsFormProps) {
  const { withAuth } = useApi();
  const [loading, setLoading] = useState(false);
  const [ignoreRobots, setIgnoreRobots] = useState(
    initialSettings?.ignoreRobots ?? false,
  );

  async function handleSave() {
    setLoading(true);
    try {
      await withAuth(() =>
        api.projects.update(projectId, {
          settings: { ignoreRobots },
        }),
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
        <CardTitle>Crawl Settings</CardTitle>
        <CardDescription>
          Configure how the crawler discovers and accesses pages on your site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="ignoreRobots"
            checked={ignoreRobots}
            onChange={(e) => setIgnoreRobots(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div className="space-y-1">
            <Label htmlFor="ignoreRobots" className="cursor-pointer">
              Ignore robots.txt
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, the crawler will access all pages regardless of
              robots.txt rules. Useful for sites that block SEO bots but still
              want a full audit.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
