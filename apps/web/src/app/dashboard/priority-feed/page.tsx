"use client";

import { PriorityFeedCard } from "../projects/_components/priority-feed-card";

export default function PriorityFeedPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Portfolio Priority Feed
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-project prioritized actions ranked by urgency and expected
          impact.
        </p>
      </div>
      <PriorityFeedCard />
    </div>
  );
}
