"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { applyProjectWorkspaceDefaults } from "@/lib/project-workspace-defaults";
import { normalizeDomain } from "@llm-boost/shared";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [autoStartCrawl, setAutoStartCrawl] = useState(true);
  const [enableWeeklyDigest, setEnableWeeklyDigest] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    domain?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.account
      .getDigestPreferences()
      .then((prefs) => {
        if (prefs.digestFrequency === "off") {
          setEnableWeeklyDigest(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation matching CreateProjectSchema
    const newErrors: { name?: string; domain?: string } = {};

    if (!name.trim() || name.length > 100) {
      newErrors.name = "Name is required and must be 100 characters or fewer.";
    }

    if (!domain.trim()) {
      newErrors.domain = "Domain is required.";
    } else {
      const normalized = normalizeDomain(domain);
      if (!normalized) {
        newErrors.domain = "Please enter a valid domain (e.g. example.com).";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    try {
      const normalizedDomain = normalizeDomain(domain);
      const result = await api.projects.create({
        name,
        domain: normalizedDomain || domain,
      });

      try {
        await applyProjectWorkspaceDefaults({
          projectId: result.id,
          domainOrUrl: normalizedDomain || domain,
          defaults: {
            schedule: "weekly",
            autoRunOnCrawl: true,
            enableVisibilitySchedule: true,
            enableWeeklyDigest,
          },
        });
      } catch {
        // Non-blocking: continue with project creation flow even if
        // one or more workspace defaults cannot be applied right now.
      }

      if (autoStartCrawl) {
        try {
          const crawl = await api.crawls.start(result.id);
          router.push(`/dashboard/crawl/${crawl.id}`);
          return;
        } catch {
          router.push(`/dashboard/projects/${result.id}?autocrawl=failed`);
          return;
        }
      }

      router.push(`/dashboard/projects/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
          <CardDescription>
            Add a website to audit for AI-readiness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Form-level error */}
            {errors.form && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.form}
              </div>
            )}

            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="My Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Domain field */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                type="text"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onBlur={() => setDomain(normalizeDomain(domain))}
              />
              {errors.domain && (
                <p className="text-sm text-destructive">{errors.domain}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the root domain to audit. Protocol and www are stripped
                automatically.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="auto-start-crawl"
                checked={autoStartCrawl}
                onCheckedChange={(value) => setAutoStartCrawl(value === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="auto-start-crawl">
                  Start first crawl automatically
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recommended for faster setup. We will create the project and
                  immediately run the first crawl.
                </p>
                <p className="text-xs text-muted-foreground">
                  Post-crawl AI automation is enabled by default and starts
                  after crawl completion.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="weekly-digest"
                checked={enableWeeklyDigest}
                onCheckedChange={(value) =>
                  setEnableWeeklyDigest(value === true)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="weekly-digest">
                  Send me a weekly performance digest
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recommended. Receive a Monday summary of ranking changes and
                  top actions.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? autoStartCrawl
                    ? "Creating & Starting Crawl..."
                    : "Creating..."
                  : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
