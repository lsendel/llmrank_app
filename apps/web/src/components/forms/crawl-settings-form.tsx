"use client";

import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import { usePlan } from "@/hooks/use-plan";

type CrawlSchedule = "manual" | "daily" | "weekly" | "monthly";

interface CrawlSettingsFormProps {
  projectId: string;
  initialSettings?: {
    ignoreRobots?: boolean;
    schedule?: CrawlSchedule;
    allowHttpFallback?: boolean;
  };
}

function getNextCrawlDate(schedule: CrawlSchedule): string | null {
  if (schedule === "manual") return null;

  const now = new Date();

  if (schedule === "daily") {
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (schedule === "monthly") {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    return next.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (schedule === "weekly") {
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    next.setHours(0, 0, 0, 0);
    return next.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return null;
}

export function CrawlSettingsForm({
  projectId,
  initialSettings,
}: CrawlSettingsFormProps) {
  const { withAuth } = useApi();
  const { isFree, isStarter } = usePlan();
  const [loading, setLoading] = useState(false);
  const [ignoreRobots, setIgnoreRobots] = useState(
    initialSettings?.ignoreRobots ?? false,
  );
  const [schedule, setSchedule] = useState<CrawlSchedule>(
    initialSettings?.schedule ?? "manual",
  );
  const [allowHttpFallback, setAllowHttpFallback] = useState(
    initialSettings?.allowHttpFallback ?? false,
  );
  const [httpFallbackGlobal, setHttpFallbackGlobal] = useState(false);

  useEffect(() => {
    if (!isFree) {
      api.public
        .isHttpFallbackEnabled()
        .then((enabled) => setHttpFallbackGlobal(enabled))
        .catch(() => {});
    }
  }, [isFree]);

  async function handleSave() {
    setLoading(true);
    try {
      await withAuth(() =>
        api.projects.update(projectId, {
          settings: { ignoreRobots, schedule, allowHttpFallback },
        }),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const nextCrawlDate = getNextCrawlDate(schedule);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crawl Settings</CardTitle>
        <CardDescription>
          Configure how the crawler discovers and accesses pages on your site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Crawl Schedule</Label>
          <Select
            value={schedule}
            onValueChange={(value) => setSchedule(value as CrawlSchedule)}
          >
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual only</SelectItem>
              <SelectItem value="daily" disabled={isFree || isStarter}>
                Daily (every day) {(isFree || isStarter) && "\u2014 Pro+"}
              </SelectItem>
              <SelectItem value="monthly" disabled={isFree}>
                Monthly (1st of each month) {isFree && "\u2014 Starter+"}
              </SelectItem>
              <SelectItem value="weekly" disabled={isFree || isStarter}>
                Weekly (every Monday) {(isFree || isStarter) && "\u2014 Pro+"}
              </SelectItem>
            </SelectContent>
          </Select>
          {nextCrawlDate && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Next scheduled crawl: {nextCrawlDate}
            </p>
          )}
        </div>

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
        {httpFallbackGlobal && !isFree && (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="allowHttpFallback"
              checked={allowHttpFallback}
              onChange={(e) => setAllowHttpFallback(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div className="space-y-1">
              <Label htmlFor="allowHttpFallback" className="cursor-pointer">
                Allow HTTP fallback
              </Label>
              <p className="text-sm text-muted-foreground">
                Try HTTP if HTTPS connection fails during crawling. Only
                recommended for sites that do not support HTTPS.
              </p>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
