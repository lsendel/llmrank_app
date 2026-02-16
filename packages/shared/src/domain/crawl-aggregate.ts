import { CrawlStatus } from "./crawl-status";

export class CrawlJobAggregate {
  public readonly status: CrawlStatus;

  constructor(
    public readonly id: string,
    public readonly projectId: string,
    status: string,
    public readonly startedAt?: Date | null,
  ) {
    this.status = CrawlStatus.from(status);
  }

  canIngest(): boolean {
    return this.status.isActive;
  }

  transition(next: string): CrawlJobAggregate {
    const newStatus = this.status.transition(next);
    return new CrawlJobAggregate(
      this.id,
      this.projectId,
      newStatus.value,
      this.startedAt,
    );
  }

  isExpired(timeoutMinutes: number): boolean {
    if (!this.startedAt) return false;
    const elapsed = Date.now() - this.startedAt.getTime();
    return elapsed > timeoutMinutes * 60 * 1000;
  }
}
