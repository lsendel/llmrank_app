"use client";

import { NewProjectPageLayout } from "./_components/new-project-page-sections";
import { useNewProjectPageState } from "./_hooks/use-new-project-page-state";

export default function NewProjectPage() {
  const {
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
    setName,
    setDomain,
    setAutoStartCrawl,
    setCrawlSchedule,
    setEnableAutomationPipeline,
    setEnableVisibilitySchedule,
    setEnableWeeklyDigest,
    handleDomainBlur,
    handleSubmit,
    handleCancel,
  } = useNewProjectPageState();

  return (
    <NewProjectPageLayout
      name={name}
      domain={domain}
      autoStartCrawl={autoStartCrawl}
      crawlSchedule={crawlSchedule}
      enableAutomationPipeline={enableAutomationPipeline}
      enableVisibilitySchedule={enableVisibilitySchedule}
      enableWeeklyDigest={enableWeeklyDigest}
      errors={errors}
      submitting={submitting}
      submitLabel={submitLabel}
      onNameChange={setName}
      onDomainChange={setDomain}
      onDomainBlur={handleDomainBlur}
      onAutoStartCrawlChange={setAutoStartCrawl}
      onCrawlScheduleChange={setCrawlSchedule}
      onEnableAutomationPipelineChange={setEnableAutomationPipeline}
      onEnableVisibilityScheduleChange={setEnableVisibilitySchedule}
      onEnableWeeklyDigestChange={setEnableWeeklyDigest}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
}
