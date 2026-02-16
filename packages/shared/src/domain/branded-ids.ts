declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type ProjectId = Brand<string, "ProjectId">;
export type UserId = Brand<string, "UserId">;
export type CrawlId = Brand<string, "CrawlId">;
export type PageId = Brand<string, "PageId">;

export function projectId(id: string): ProjectId {
  return id as ProjectId;
}
export function userId(id: string): UserId {
  return id as UserId;
}
export function crawlId(id: string): CrawlId {
  return id as CrawlId;
}
export function pageId(id: string): PageId {
  return id as PageId;
}
