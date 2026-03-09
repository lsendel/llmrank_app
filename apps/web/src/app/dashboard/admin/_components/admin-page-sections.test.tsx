import { fireEvent, render, screen } from "@testing-library/react";
import type { AdminCustomer, AdminIngestDetails, Promo } from "@/lib/api";
import { describe, expect, it, vi } from "vitest";
import {
  AdminAccessDeniedState,
  AdminBlockedDomainsCard,
  AdminCreatePromoDialog,
  AdminCustomerActionDialog,
  AdminCustomersCard,
  AdminPageHeader,
  AdminPipelineHealthCard,
  AdminPromoCodesCard,
  AdminSettingsCard,
  AdminStatsGrid,
  AdminSystemHealthGrid,
  CancelJobDialog,
  IngestDetailDialog,
} from "./admin-page-sections";

const Icon = ({ className }: { className?: string }) => (
  <svg className={className} aria-hidden="true" />
);

const customers: AdminCustomer[] = [
  {
    id: "user_1",
    email: "alice@example.com",
    name: "Alice",
    plan: "starter",
    stripeCustomerId: "cus_1",
    createdAt: "2024-03-10T00:00:00.000Z",
  },
  {
    id: "user_2",
    email: "blocked@example.com",
    name: "Blocked User",
    plan: "pro",
    stripeCustomerId: "cus_2",
    createdAt: "2024-03-10T00:00:00.000Z",
    status: "banned",
  } as AdminCustomer & { status: string },
];

const promo: Promo = {
  id: "promo_1",
  code: "SAVE20",
  stripeCouponId: "coupon_1",
  discountType: "percent_off",
  discountValue: 20,
  duration: "once",
  durationMonths: null,
  maxRedemptions: 10,
  timesRedeemed: 2,
  expiresAt: null,
  active: true,
  createdAt: "2024-03-10T00:00:00.000Z",
};

const ingestDetails: AdminIngestDetails = {
  pendingJobs: [
    {
      id: "job_1",
      projectId: "proj_1",
      projectName: "Marketing Site",
      status: "pending",
      createdAt: "2024-03-10T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    },
  ],
  runningJobs: [],
  failedJobs: [],
  outboxEvents: [],
};

describe("admin page sections", () => {
  it("renders the admin shell header, stat cards, and system health", () => {
    render(
      <>
        <AdminAccessDeniedState />
        <AdminPageHeader />
        <AdminStatsGrid
          statCards={[{ title: "MRR", value: "$100.00", icon: Icon }]}
        />
        <AdminSystemHealthGrid
          metrics={{
            activeCrawls: 3,
            errorsLast24h: 1,
            systemTime: "2024-03-10T10:00:00.000Z",
          }}
        />
      </>,
    );

    expect(screen.getByText("Admin access required")).toBeInTheDocument();
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.getByText("MRR")).toBeInTheDocument();
    expect(screen.getByText("24h Failures")).toBeInTheDocument();
    expect(screen.getByText("Last Heartbeat")).toBeInTheDocument();
  });

  it("wires pipeline and customer card callbacks", () => {
    const onOpenDetail = vi.fn();
    const onSearchChange = vi.fn();
    const onOpenCustomerAction = vi.fn();

    render(
      <>
        <AdminPipelineHealthCard
          ingestCards={[
            {
              title: "Pending Crawl Jobs",
              value: "5",
              icon: Icon,
              description: "Waiting to be dispatched",
              tone: "default",
              detailKey: "pending",
              trend: [
                { timestamp: 1, value: 2 },
                { timestamp: 2, value: 5 },
              ],
            },
          ]}
          onOpenDetail={onOpenDetail}
        />
        <AdminCustomersCard
          customers={customers}
          customersLoading={false}
          search=""
          onSearchChange={onSearchChange}
          onOpenCustomerAction={onOpenCustomerAction}
        />
      </>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "View Pending Crawl Jobs details" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Search by name or email..."),
      {
        target: { value: "alice" },
      },
    );
    fireEvent.click(screen.getAllByTitle("Change plan")[0]!);
    fireEvent.click(screen.getByTitle("Block user"));
    fireEvent.click(screen.getByTitle("Unblock user"));

    expect(onOpenDetail).toHaveBeenCalledWith("pending");
    expect(onSearchChange).toHaveBeenCalledWith("alice");
    expect(onOpenCustomerAction).toHaveBeenNthCalledWith(
      1,
      { userId: "user_1", name: "Alice", action: "change-plan" },
      "starter",
    );
    expect(onOpenCustomerAction).toHaveBeenNthCalledWith(2, {
      userId: "user_1",
      name: "Alice",
      action: "block",
    });
    expect(onOpenCustomerAction).toHaveBeenNthCalledWith(3, {
      userId: "user_2",
      name: "Blocked User",
      action: "unblock",
    });
  });

  it("renders promo, settings, and blocked-domain controls", () => {
    const onOpenCreatePromo = vi.fn();
    const onToggleHttpFallback = vi.fn();
    const onAddBlocked = vi.fn();
    const onRemoveBlocked = vi.fn();

    render(
      <>
        <AdminPromoCodesCard
          promos={[promo]}
          actionTarget={null}
          onOpenCreatePromo={onOpenCreatePromo}
          onDeactivatePromo={vi.fn()}
        />
        <AdminSettingsCard
          httpFallbackEnabled
          onToggleHttpFallback={onToggleHttpFallback}
        />
        <AdminBlockedDomainsCard
          blockedDomains={[
            { id: "blocked_1", domain: "bad.example.com", reason: "Spam" },
          ]}
          newBlockDomain=""
          newBlockReason=""
          onNewBlockDomainChange={vi.fn()}
          onNewBlockReasonChange={vi.fn()}
          onAddBlocked={onAddBlocked}
          onRemoveBlocked={onRemoveBlocked}
        />
      </>,
    );

    expect(screen.getByText("SAVE20")).toBeInTheDocument();
    expect(screen.getByText("20% off · once · 2/10 used")).toBeInTheDocument();
    expect(screen.getByText("bad.example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Promo/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Block/i }));
    fireEvent.click(screen.getAllByRole("button")[3]!);

    expect(onOpenCreatePromo).toHaveBeenCalledTimes(1);
    expect(onToggleHttpFallback).toHaveBeenCalledTimes(1);
    expect(onAddBlocked).toHaveBeenCalledTimes(1);
    expect(onRemoveBlocked).toHaveBeenCalledWith("blocked_1");
  });

  it("renders the create-promo dialog and forwards field changes", () => {
    const onPromoChange = vi.fn();

    render(
      <AdminCreatePromoDialog
        open
        newPromo={{
          code: "SAVE20",
          discountType: "percent_off",
          discountValue: 20,
          duration: "once",
          durationMonths: undefined,
          maxRedemptions: undefined,
          expiresAt: "",
        }}
        creatingPromo={false}
        onOpenChange={vi.fn()}
        onNewPromoChange={onPromoChange}
        onCreatePromo={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("SAVE20"), {
      target: { value: "SAVE50" },
    });

    expect(screen.getByText("Create Promo Code")).toBeInTheDocument();
    expect(onPromoChange).toHaveBeenCalledWith({ code: "SAVE50" });
  });

  it("renders the customer-action dialog and forwards reason changes", () => {
    const onActionReasonChange = vi.fn();

    render(
      <AdminCustomerActionDialog
        customerActionDialog={{
          userId: "user_1",
          name: "Alice",
          action: "block",
        }}
        actionReason=""
        selectedPlan="starter"
        customerActionLoading={false}
        onOpenChange={vi.fn()}
        onActionReasonChange={onActionReasonChange}
        onSelectedPlanChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Reason for this action..."), {
      target: { value: "Terms violation" },
    });

    expect(screen.getByText("Block User")).toBeInTheDocument();
    expect(onActionReasonChange).toHaveBeenCalledWith("Terms violation");
  });

  it("renders the ingest-detail dialog and job actions", () => {
    const onCancelJob = vi.fn();
    const onRetryJob = vi.fn(async () => undefined);
    const onReplayEvent = vi.fn(async () => undefined);

    render(
      <IngestDetailDialog
        type="pending"
        details={ingestDetails}
        actionTarget={null}
        onClose={vi.fn()}
        onRetryJob={onRetryJob}
        onCancelJob={onCancelJob}
        onReplayEvent={onReplayEvent}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Pending Crawl Jobs")).toBeInTheDocument();
    expect(onRetryJob).toHaveBeenCalledWith("job_1");
    expect(onCancelJob).toHaveBeenCalledWith("job_1", "Marketing Site");
    expect(onReplayEvent).not.toHaveBeenCalled();
  });

  it("renders the cancel-job dialog and confirmation action", () => {
    const onConfirmCancel = vi.fn();

    render(
      <CancelJobDialog
        job={{ jobId: "job_1", projectName: "Marketing Site" }}
        reason="Need to stop"
        loading={false}
        onReasonChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={onConfirmCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm cancel" }));

    expect(screen.getByText("Cancel crawl job?")).toBeInTheDocument();
    expect(onConfirmCancel).toHaveBeenCalledTimes(1);
  });
});
