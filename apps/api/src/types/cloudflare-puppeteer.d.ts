declare module "@cloudflare/puppeteer" {
  export interface BrowserWorker {}

  export interface Page {
    setViewport(options: { width: number; height: number }): Promise<void>;
    goto(url: string, options?: Record<string, unknown>): Promise<void>;
    evaluate<T>(fn: () => T): Promise<T>;
  }

  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  const puppeteer: {
    launch(binding: BrowserWorker): Promise<Browser>;
  };
  export default puppeteer;
}
