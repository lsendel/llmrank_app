import { useCallback, useMemo, useState } from "react";
import type { CrawledPage } from "@/lib/api";
import {
  filterPages,
  getNextSortState,
  getRedirectCount,
  sortPages,
  type SortDirection,
  type SortField,
} from "./pages-tab-helpers";

type UsePagesTabActionsArgs = {
  pages: CrawledPage[];
};

export function usePagesTabActions({ pages }: UsePagesTabActionsArgs) {
  const [sortField, setSortField] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showRedirects, setShowRedirects] = useState(false);

  const redirectCount = useMemo(() => getRedirectCount(pages), [pages]);
  const sortedPages = useMemo(() => {
    const filteredPages = filterPages(pages, showRedirects);
    return sortPages(filteredPages, sortField, sortDir);
  }, [pages, showRedirects, sortDir, sortField]);

  const handleSort = useCallback(
    (field: SortField) => {
      const nextState = getNextSortState(sortField, sortDir, field);
      setSortField(nextState.sortField);
      setSortDir(nextState.sortDir);
    },
    [sortDir, sortField],
  );

  const handleExpandedRowToggle = useCallback((pageId: string) => {
    setExpandedRow((current) => (current === pageId ? null : pageId));
  }, []);

  const handleShowRedirectsChange = useCallback((checked: boolean) => {
    setShowRedirects(checked);
  }, []);

  return {
    sortField,
    sortDir,
    expandedRow,
    showRedirects,
    redirectCount,
    sortedPages,
    handleSort,
    handleExpandedRowToggle,
    handleShowRedirectsChange,
  };
}
