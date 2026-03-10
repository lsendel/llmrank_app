"use client";

import { useState } from "react";
import { WizardStepper } from "./wizard-stepper";

const STEPS = ["Website", "Crawl Scope", "Competitors", "Launch"];

interface WizardData {
  // Step 1
  name: string;
  domain: string;
  keywords: Array<{ keyword: string; source: "ai" | "extracted" | "user" }>;
  // Step 2
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  enablePipeline: boolean;
  enableVisibility: boolean;
  // Step 3
  competitors: Array<{ domain: string; selected: boolean }>;
  // Step 4 — computed from above
}

export function ProjectWizard() {
  const [_step, _setStep] = useState(0);
  const [_data, _setData] = useState<WizardData>({
    name: "",
    domain: "",
    keywords: [],
    pageLimit: 10,
    crawlDepth: 3,
    crawlSchedule: "weekly",
    enablePipeline: true,
    enableVisibility: true,
    competitors: [],
  });

  const _updateData = (partial: Partial<WizardData>) =>
    _setData((prev) => ({ ...prev, ...partial }));

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <WizardStepper steps={STEPS} currentStep={_step} />
      <div className="rounded-lg border border-border p-6">
        {/* Step components rendered here — implemented in Tasks 22-25 */}
        {_step === 0 && <div>Step 1 placeholder</div>}
        {_step === 1 && <div>Step 2 placeholder</div>}
        {_step === 2 && <div>Step 3 placeholder</div>}
        {_step === 3 && <div>Step 4 placeholder</div>}
      </div>
    </div>
  );
}
