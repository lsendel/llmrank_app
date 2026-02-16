/**
 * DTO mappers for crawl API responses.
 */

export function toCrawlResponse(entity: Record<string, any>) {
  return {
    id: entity.id,
    projectId: entity.projectId,
    status: entity.status,
    config: entity.config ?? null,
    pagesFound: entity.pagesFound ?? null,
    pagesCrawled: entity.pagesCrawled ?? null,
    pagesScored: entity.pagesScored ?? null,
    overallScore: entity.overallScore ?? null,
    letterGrade: entity.letterGrade ?? null,
    scores: entity.scores ?? null,
    errorMessage: entity.errorMessage ?? null,
    startedAt: entity.startedAt ?? null,
    completedAt: entity.completedAt ?? null,
    createdAt: entity.createdAt,
  };
}

export function toCrawlListResponse(entities: Record<string, any>[]) {
  return entities.map(toCrawlResponse);
}
