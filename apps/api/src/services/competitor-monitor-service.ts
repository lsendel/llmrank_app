import { diffBenchmarks } from "./competitor-diff-service";

interface CompetitorMonitorDeps {
  competitors: {
    listDueForBenchmark(now: Date, limit?: number): Promise<any[]>;
    updateMonitoring(id: string, data: any): Promise<any>;
  };
  competitorBenchmarks: {
    getLatest(projectId: string, domain: string): Promise<any>;
    create(data: any): Promise<any>;
  };
  competitorEvents: {
    create(data: any): Promise<any>;
  };
  outbox: {
    enqueue(data: any): Promise<any>;
  };
  benchmarkService: {
    benchmarkCompetitor(args: {
      projectId: string;
      competitorDomain: string;
      competitorLimit: number;
    }): Promise<any>;
  };
}

export function computeNextBenchmarkAt(frequency: string): Date {
  const next = new Date();
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

export function createCompetitorMonitorService(deps: CompetitorMonitorDeps) {
  return {
    async processScheduledBenchmarks() {
      const now = new Date();
      const dueCompetitors = await deps.competitors.listDueForBenchmark(
        now,
        20,
      );

      const results = { processed: 0, events: 0, errors: 0 };

      for (const competitor of dueCompetitors) {
        try {
          // 1. Get previous benchmark
          const previous = await deps.competitorBenchmarks.getLatest(
            competitor.projectId,
            competitor.domain,
          );

          // 2. Run new benchmark
          const benchmark = await deps.benchmarkService.benchmarkCompetitor({
            projectId: competitor.projectId,
            competitorDomain: competitor.domain,
            competitorLimit: Infinity,
          });

          // 3. Diff and detect changes
          const events = diffBenchmarks(competitor.domain, previous, benchmark);

          // 4. Store events
          for (const event of events) {
            await deps.competitorEvents.create({
              projectId: competitor.projectId,
              competitorDomain: competitor.domain,
              eventType: event.eventType,
              severity: event.severity,
              summary: event.summary,
              data: event.data,
              benchmarkId: benchmark.id,
            });

            // 5. Emit notification for critical/warning events
            if (event.severity === "critical" || event.severity === "warning") {
              await deps.outbox.enqueue({
                type: "webhook:alert",
                eventType: `competitor_${event.eventType}`,
                payload: {
                  projectId: competitor.projectId,
                  domain: competitor.domain,
                  ...event,
                },
                projectId: competitor.projectId,
              });
            }

            results.events++;
          }

          // 6. Update monitoring schedule
          await deps.competitors.updateMonitoring(competitor.id, {
            lastBenchmarkAt: now,
            nextBenchmarkAt: computeNextBenchmarkAt(
              competitor.monitoringFrequency,
            ),
          });

          results.processed++;
        } catch (error) {
          console.error(
            `Failed to benchmark competitor ${competitor.domain}:`,
            error,
          );
          results.errors++;
          // Still update nextBenchmarkAt to avoid infinite retry
          await deps.competitors.updateMonitoring(competitor.id, {
            nextBenchmarkAt: computeNextBenchmarkAt(
              competitor.monitoringFrequency,
            ),
          });
        }
      }

      return results;
    },
  };
}
