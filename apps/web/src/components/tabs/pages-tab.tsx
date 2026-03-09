"use client";

import type { CrawledPage } from "@/lib/api";
import {
  PagesTabCard,
  PagesTabEmptyState,
  PagesTabRedirectToggle,
  PagesTabTable,
} from "./pages-tab-sections";
import { usePagesTabActions } from "./use-pages-tab-actions";

export function PagesTab({
  pages,
  projectId,
}: {
  pages: CrawledPage[];
  projectId: string;
}) {
  const {
    sortField,
    sortDir,
    expandedRow,
    showRedirects,
    redirectCount,
    sortedPages,
    handleSort,
    handleExpandedRowToggle,
    handleShowRedirectsChange,
  } = usePagesTabActions({ pages });

  if (pages.length === 0) {
    return <PagesTabEmptyState />;
  }

  return (
    <PagesTabCard>
      <PagesTabRedirectToggle
        redirectCount={redirectCount}
        showRedirects={showRedirects}
        onShowRedirectsChange={handleShowRedirectsChange}
      />
      <PagesTabTable
        pages={sortedPages}
        projectId={projectId}
        sortField={sortField}
        sortDir={sortDir}
        expandedRow={expandedRow}
        onSort={handleSort}
        onToggleExpandedRow={handleExpandedRowToggle}
      />
    </PagesTabCard>
  );
}
