"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeDomain } from "@llm-boost/shared";
import { api, ApiError } from "@/lib/api";
import { applyProjectWorkspaceDefaults } from "@/lib/project-workspace-defaults";
import {
  getNewProjectSubmitLabel,
  type CrawlSchedule,
  type NewProjectFormErrors,
  validateNewProjectForm,
} from "../new-project-page-helpers";

export function useNewProjectPageState() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [autoStartCrawl, setAutoStartCrawl] = useState(true);
  const [crawlSchedule, setCrawlSchedule] = useState<CrawlSchedule>("weekly");
  const [enableAutomationPipeline, setEnableAutomationPipeline] =
    useState(true);
  const [enableVisibilitySchedule, setEnableVisibilitySchedule] =
    useState(true);
  const [enableWeeklyDigest, setEnableWeeklyDigest] = useState(false);
  const [errors, setErrors] = useState<NewProjectFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    api.account
      .getDigestPreferences()
      .then((prefs) => {
        if (isMounted && prefs.digestFrequency === "off") {
          setEnableWeeklyDigest(true);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors = validateNewProjectForm({ name, domain });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);

    try {
      const normalizedDomain = normalizeDomain(domain);
      const project = await api.projects.create({
        name,
        domain: normalizedDomain || domain,
      });

      try {
        await applyProjectWorkspaceDefaults({
          projectId: project.id,
          domainOrUrl: normalizedDomain || domain,
          defaults: {
            schedule: crawlSchedule,
            autoRunOnCrawl: enableAutomationPipeline,
            enableVisibilitySchedule,
            enableWeeklyDigest,
          },
        });
      } catch {
        // Non-blocking: continue with project creation flow even if one or
        // more workspace defaults cannot be applied right now.
      }

      if (autoStartCrawl) {
        try {
          const crawl = await api.crawls.start(project.id);
          router.push(`/dashboard/crawl/${crawl.id}`);
          return;
        } catch {
          router.push(`/dashboard/projects/${project.id}?autocrawl=failed`);
          return;
        }
      }

      router.push(`/dashboard/projects/${project.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({ form: error.message });
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      setSubmitting(false);
    }
  }

  return {
    name,
    domain,
    autoStartCrawl,
    crawlSchedule,
    enableAutomationPipeline,
    enableVisibilitySchedule,
    enableWeeklyDigest,
    errors,
    submitting,
    submitLabel: getNewProjectSubmitLabel(submitting, autoStartCrawl),
    setName,
    setDomain,
    setAutoStartCrawl,
    setCrawlSchedule,
    setEnableAutomationPipeline,
    setEnableVisibilitySchedule,
    setEnableWeeklyDigest,
    handleDomainBlur: () => setDomain((current) => normalizeDomain(current)),
    handleSubmit,
    handleCancel: () => router.back(),
  };
}
