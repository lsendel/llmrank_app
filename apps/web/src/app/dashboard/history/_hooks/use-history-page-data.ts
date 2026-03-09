import { useCallback, useState } from "react";
import { api, type CrawlJob, type PaginatedResponse } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { usePlan } from "@/hooks/use-plan";
import { HISTORY_PAGE_SIZE } from "../history-page-helpers";

export function useHistoryPageData() {
  const [page, setPage] = useState(1);
  const { isFree } = usePlan();

  const { data, isLoading } = useApiSWR<PaginatedResponse<CrawlJob>>(
    isFree ? null : `crawl-history-${page}`,
    useCallback(() => api.crawls.getHistory(page, HISTORY_PAGE_SIZE), [page]),
  );

  const history = data?.data ?? [];
  const pagination = data?.pagination ?? null;
  const totalPages = pagination?.totalPages ?? 1;

  const goToPreviousPage = useCallback(() => {
    setPage((currentPage) => Math.max(1, currentPage - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPage((currentPage) => Math.min(totalPages, currentPage + 1));
  }, [totalPages]);

  return {
    history,
    isFree,
    isLoading,
    page,
    pagination,
    showPagination: Boolean(pagination && pagination.totalPages > 1),
    goToPreviousPage,
    goToNextPage,
  };
}
