"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepper } from "./wizard-stepper";
import { WebsiteStep } from "./steps/website-step";
import { CrawlStep } from "./steps/crawl-step";
import { CompetitorsStep } from "./steps/competitors-step";
import { LaunchStep } from "./steps/launch-step";
import { CrawlProgressStream } from "./crawl-progress-stream";
import { api } from "@/lib/api";

const STEPS = ["Website", "Crawl Scope", "Competitors", "Launch"];

interface KeywordItem {
  keyword: string;
  source: "ai" | "extracted" | "user";
}

interface CompetitorItem {
  domain: string;
  reason?: string;
  selected: boolean;
}

interface WizardData {
  name: string;
  domain: string;
  keywords: KeywordItem[];
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  enablePipeline: boolean;
  enableVisibility: boolean;
  competitors: CompetitorItem[];
}

export function ProjectWizard({
  planMaxPages = 10,
  maxCompetitors = 3,
}: {
  planMaxPages?: number;
  maxCompetitors?: number;
} = {}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const [data, setData] = useState<WizardData>({
    name: "",
    domain: "",
    keywords: [],
    pageLimit: planMaxPages,
    crawlDepth: 3,
    crawlSchedule: "weekly",
    enablePipeline: true,
    enableVisibility: true,
    competitors: [],
  });

  const updateData = (partial: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  async function handleLaunch() {
    setLaunching(true);
    try {
      // 1. Create project
      let normalizedDomain = data.domain.trim();
      if (
        !normalizedDomain.startsWith("http://") &&
        !normalizedDomain.startsWith("https://")
      ) {
        normalizedDomain = `https://${normalizedDomain}`;
      }

      const project = await api.projects.create({
        name: data.name.trim(),
        domain: normalizedDomain,
      });
      setProjectId(project.id);

      // 2. Save keywords
      const selectedKeywords = data.keywords.map((k) => k.keyword);
      if (selectedKeywords.length > 0) {
        await api.keywords.createBatch(project.id, selectedKeywords);
      }

      // 3. Benchmark selected competitors (saves them to the project)
      const selectedCompetitors = data.competitors
        .filter((c) => c.selected)
        .map((c) => c.domain);
      for (const compDomain of selectedCompetitors) {
        // Uses existing POST /api/competitors/benchmark endpoint
        await api.competitorMonitoring
          .addCompetitor(project.id, compDomain)
          .catch(() => {}); // best-effort
      }

      // 4. Start crawl
      const crawl = await api.crawls.start(project.id);
      setCrawlId(crawl.id);
    } catch (err) {
      console.error("Wizard launch failed:", err);
      setLaunching(false);
    }
  }

  function handleCrawlComplete() {
    if (projectId) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  }

  // Show crawl progress after launch
  if (crawlId) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        <WizardStepper steps={STEPS} currentStep={4} />
        <div className="rounded-lg border border-border p-6">
          <CrawlProgressStream
            crawlId={crawlId}
            onComplete={handleCrawlComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <WizardStepper steps={STEPS} currentStep={step} />
      <div className="rounded-lg border border-border p-6">
        {step === 0 && (
          <WebsiteStep
            name={data.name}
            domain={data.domain}
            keywords={data.keywords}
            onUpdate={updateData}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <CrawlStep
            pageLimit={data.pageLimit}
            crawlDepth={data.crawlDepth}
            crawlSchedule={data.crawlSchedule}
            enablePipeline={data.enablePipeline}
            enableVisibility={data.enableVisibility}
            planMaxPages={planMaxPages}
            onUpdate={updateData}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <CompetitorsStep
            domain={data.domain}
            keywords={data.keywords.map((k) => k.keyword)}
            competitors={data.competitors}
            maxCompetitors={maxCompetitors}
            onUpdate={(competitors) => updateData({ competitors })}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <LaunchStep
            name={data.name}
            domain={data.domain}
            keywordCount={data.keywords.length}
            pageLimit={data.pageLimit}
            crawlDepth={data.crawlDepth}
            crawlSchedule={data.crawlSchedule}
            enablePipeline={data.enablePipeline}
            enableVisibility={data.enableVisibility}
            competitorCount={data.competitors.filter((c) => c.selected).length}
            launching={launching}
            onBack={() => setStep(2)}
            onLaunch={handleLaunch}
          />
        )}
      </div>
    </div>
  );
}
