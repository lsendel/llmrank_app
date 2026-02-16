const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["queued", "crawling", "failed", "cancelled"],
  queued: ["crawling", "failed", "cancelled"],
  crawling: ["scoring", "failed", "cancelled"],
  scoring: ["complete", "failed", "cancelled"],
  complete: [],
  failed: [],
  cancelled: [],
};

const TERMINAL_STATES = new Set(["complete", "failed", "cancelled"]);

export class CrawlStatus {
  private constructor(public readonly value: string) {}

  static from(value: string): CrawlStatus {
    if (!(value in VALID_TRANSITIONS)) {
      throw new Error(`Invalid crawl status: ${value}`);
    }
    return new CrawlStatus(value);
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this.value);
  }

  get isActive(): boolean {
    return !this.isTerminal;
  }

  canTransitionTo(next: string): boolean {
    return (VALID_TRANSITIONS[this.value] ?? []).includes(next);
  }

  transition(next: string): CrawlStatus {
    if (!this.canTransitionTo(next)) {
      throw new Error(`Invalid transition: ${this.value} → ${next}`);
    }
    return CrawlStatus.from(next);
  }
}
