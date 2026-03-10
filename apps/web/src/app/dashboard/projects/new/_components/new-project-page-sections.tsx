"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";
import {
  NEW_PROJECT_SCHEDULE_OPTIONS,
  NEW_PROJECT_WORKFLOW_ACTIONS,
  NEW_PROJECT_WORKFLOW_STEPS,
  type CrawlSchedule,
  type NewProjectFormErrors,
} from "../new-project-page-helpers";

interface ToggleCardProps {
  id: string;
  checked: boolean;
  label: string;
  descriptions: string[];
  onCheckedChange: (checked: boolean) => void;
}

interface NewProjectPageLayoutProps {
  name: string;
  domain: string;
  autoStartCrawl: boolean;
  crawlSchedule: CrawlSchedule;
  enableAutomationPipeline: boolean;
  enableVisibilitySchedule: boolean;
  enableWeeklyDigest: boolean;
  errors: NewProjectFormErrors;
  submitting: boolean;
  submitLabel: string;
  onNameChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onDomainBlur: () => void;
  onAutoStartCrawlChange: (checked: boolean) => void;
  onCrawlScheduleChange: (value: CrawlSchedule) => void;
  onEnableAutomationPipelineChange: (checked: boolean) => void;
  onEnableVisibilityScheduleChange: (checked: boolean) => void;
  onEnableWeeklyDigestChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
}

function ToggleCard({
  id,
  checked,
  label,
  descriptions,
  onCheckedChange,
}: ToggleCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {descriptions.map((description) => (
          <p key={description} className="text-xs text-muted-foreground">
            {description}
          </p>
        ))}
      </div>
    </div>
  );
}

export function NewProjectPageLayout({
  name,
  domain,
  autoStartCrawl,
  crawlSchedule,
  enableAutomationPipeline,
  enableVisibilitySchedule,
  enableWeeklyDigest,
  errors,
  submitting,
  submitLabel,
  onNameChange,
  onDomainChange,
  onDomainBlur,
  onAutoStartCrawlChange,
  onCrawlScheduleChange,
  onEnableAutomationPipelineChange,
  onEnableVisibilityScheduleChange,
  onEnableWeeklyDigestChange,
  onSubmit,
  onCancel,
}: NewProjectPageLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <WorkflowGuidance
        title="Project setup workflow"
        description="Configure launch defaults now so your team can operate from day one with less manual work."
        actions={NEW_PROJECT_WORKFLOW_ACTIONS}
        steps={NEW_PROJECT_WORKFLOW_STEPS}
      />

      <Card>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
          <CardDescription>
            Add a website to audit for AI-readiness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            {errors.form && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.form}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="My Website"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                type="text"
                placeholder="example.com"
                value={domain}
                onChange={(event) => onDomainChange(event.target.value)}
                onBlur={onDomainBlur}
              />
              {errors.domain && (
                <p className="text-sm text-destructive">{errors.domain}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the root domain to audit. Protocol and www are stripped
                automatically.
              </p>
            </div>

            <ToggleCard
              id="auto-start-crawl"
              checked={autoStartCrawl}
              label="Start first crawl automatically"
              descriptions={[
                "Recommended for faster setup. We will create the project and immediately run the first crawl.",
                "Post-crawl AI automation is enabled by default and starts after crawl completion.",
              ]}
              onCheckedChange={onAutoStartCrawlChange}
            />

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Default operations mode</p>
              <p className="text-xs text-muted-foreground">
                These defaults are applied as soon as the workspace is created.
              </p>

              <div className="space-y-2">
                <Label htmlFor="crawl-schedule">Recurring crawl schedule</Label>
                <Select
                  value={crawlSchedule}
                  onValueChange={(value) =>
                    onCrawlScheduleChange(value as CrawlSchedule)
                  }
                >
                  <SelectTrigger id="crawl-schedule">
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {NEW_PROJECT_SCHEDULE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ToggleCard
                id="automation-pipeline"
                checked={enableAutomationPipeline}
                label="Enable post-crawl automation pipeline"
                descriptions={[
                  "Automatically generate action plans and remediation insights after each crawl.",
                ]}
                onCheckedChange={onEnableAutomationPipelineChange}
              />

              <ToggleCard
                id="visibility-schedule"
                checked={enableVisibilitySchedule}
                label="Enable weekly AI visibility tracking"
                descriptions={[
                  "Schedules default prompts across ChatGPT, Claude, Perplexity, and Gemini.",
                ]}
                onCheckedChange={onEnableVisibilityScheduleChange}
              />
            </div>

            <ToggleCard
              id="weekly-digest"
              checked={enableWeeklyDigest}
              label="Send me a weekly performance digest"
              descriptions={[
                "Recommended. Receive a Monday summary of ranking changes and top actions.",
              ]}
              onCheckedChange={onEnableWeeklyDigestChange}
            />

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitLabel}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
