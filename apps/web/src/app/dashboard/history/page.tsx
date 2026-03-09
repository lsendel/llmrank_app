"use client";

import {
  HistoryLockedState,
  HistoryPageHeader,
  HistoryTableCard,
  HistoryWorkflowCard,
} from "./_components/history-page-sections";
import { useHistoryPageData } from "./_hooks/use-history-page-data";

export default function HistoryPage() {
  const {
    goToNextPage,
    goToPreviousPage,
    history,
    isFree,
    isLoading,
    page,
    pagination,
  } = useHistoryPageData();

  if (isFree) {
    return (
      <div className="space-y-6">
        <HistoryPageHeader />
        <HistoryWorkflowCard isFree />
        <HistoryLockedState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HistoryPageHeader />
      <HistoryWorkflowCard isFree={false} />
      <HistoryTableCard
        history={history}
        isLoading={isLoading}
        page={page}
        pagination={pagination}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
      />
    </div>
  );
}
