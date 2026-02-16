/**
 * DTO mappers for project API responses.
 * Decouples the API contract from internal DB schema.
 */

export function toProjectResponse(entity: Record<string, any>) {
  return {
    id: entity.id,
    name: entity.name,
    domain: entity.domain,
    settings: entity.settings ?? null,
    branding: entity.branding ?? null,
    plan: entity.plan ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt ?? null,
  };
}

export function toProjectDetailResponse(entity: Record<string, any>) {
  return {
    ...toProjectResponse(entity),
    latestCrawl: entity.latestCrawl ? toCrawlSummary(entity.latestCrawl) : null,
  };
}

export function toProjectListResponse(entities: Record<string, any>[]) {
  return entities.map(toProjectResponse);
}

function toCrawlSummary(crawl: Record<string, any>) {
  return {
    id: crawl.id,
    status: crawl.status,
    pagesFound: crawl.pagesFound ?? null,
    pagesCrawled: crawl.pagesCrawled ?? null,
    pagesScored: crawl.pagesScored ?? null,
    overallScore: crawl.overallScore ?? null,
    letterGrade: crawl.letterGrade ?? null,
    scores: crawl.scores ?? null,
    startedAt: crawl.startedAt ?? null,
    completedAt: crawl.completedAt ?? null,
    createdAt: crawl.createdAt,
  };
}
