"use client";

import {
  AdminAccessDeniedState,
  AdminBlockedDomainsCard,
  AdminCustomersCard,
  AdminPageHeader,
  AdminPipelineHealthCard,
  AdminPromoCodesCard,
  AdminSettingsCard,
  AdminStatsGrid,
  AdminSystemHealthGrid,
} from "./_components/admin-page-sections";
import {
  AdminCreatePromoDialog,
  AdminCustomerActionDialog,
  CancelJobDialog,
  IngestDetailDialog,
} from "./_components/admin-page-dialogs";
import { useAdminPageState } from "./_hooks/use-admin-page-state";

export default function AdminPage() {
  const state = useAdminPageState();

  if (state.accessDenied) {
    return <AdminAccessDeniedState />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader />
      <AdminStatsGrid statCards={state.statCards} />
      <AdminSystemHealthGrid metrics={state.metrics} />
      <AdminPipelineHealthCard
        ingestCards={state.ingestCards}
        onOpenDetail={state.setDetailType}
      />

      <AdminCustomersCard
        customers={state.customers}
        customersLoading={state.customersLoading}
        search={state.search}
        onSearchChange={state.setSearch}
        onOpenCustomerAction={state.openCustomerActionDialog}
      />

      <IngestDetailDialog
        type={state.detailType}
        details={state.ingestDetails}
        actionTarget={state.actionTarget}
        onClose={() => state.setDetailType(null)}
        onRetryJob={state.handleRetryJob}
        onCancelJob={state.openCancelDialog}
        onReplayEvent={state.handleReplayEvent}
      />

      <CancelJobDialog
        job={state.cancelDialog}
        reason={state.cancelReason}
        loading={
          !!state.cancelDialog &&
          state.actionTarget === `job-cancel-${state.cancelDialog.jobId}`
        }
        onReasonChange={state.setCancelReason}
        onClose={state.closeCancelDialog}
        onConfirm={() => {
          void state.handleConfirmCancelJob();
        }}
      />

      <AdminPromoCodesCard
        promos={state.promos}
        actionTarget={state.actionTarget}
        onOpenCreatePromo={() => state.setShowCreatePromo(true)}
        onDeactivatePromo={(promoId) => {
          void state.handleDeactivatePromo(promoId);
        }}
      />

      <AdminSettingsCard
        httpFallbackEnabled={state.httpFallbackEnabled}
        onToggleHttpFallback={() => {
          void state.handleToggleHttpFallback();
        }}
      />

      <AdminBlockedDomainsCard
        blockedDomains={state.blockedDomains}
        newBlockDomain={state.newBlockDomain}
        newBlockReason={state.newBlockReason}
        onNewBlockDomainChange={state.setNewBlockDomain}
        onNewBlockReasonChange={state.setNewBlockReason}
        onAddBlocked={() => {
          void state.handleAddBlocked();
        }}
        onRemoveBlocked={(id) => {
          void state.handleRemoveBlocked(id);
        }}
      />

      <AdminCreatePromoDialog
        open={state.showCreatePromo}
        newPromo={state.newPromo}
        creatingPromo={state.creatingPromo}
        onOpenChange={state.setShowCreatePromo}
        onNewPromoChange={state.updateNewPromo}
        onCreatePromo={() => {
          void state.handleCreatePromo();
        }}
      />

      <AdminCustomerActionDialog
        customerActionDialog={state.customerActionDialog}
        actionReason={state.actionReason}
        selectedPlan={state.selectedPlan}
        customerActionLoading={state.customerActionLoading}
        onOpenChange={state.handleCustomerActionDialogOpenChange}
        onActionReasonChange={state.setActionReason}
        onSelectedPlanChange={state.setSelectedPlan}
        onCancel={() => state.handleCustomerActionDialogOpenChange(false)}
        onConfirm={() => {
          void state.handleCustomerAction();
        }}
      />
    </div>
  );
}
