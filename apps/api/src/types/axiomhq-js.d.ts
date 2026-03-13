declare module "@axiomhq/js" {
  export class Axiom {
    constructor(options: { token: string; orgId: string });
    ingest(dataset: string, events: unknown[]): Promise<void>;
    flush(): Promise<void>;
  }
}
