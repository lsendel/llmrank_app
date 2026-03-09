import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PaymentRecord, PromoInfo, SubscriptionInfo } from "@/lib/api";
import {
  BillingAvailablePlansCard,
  BillingCurrentPlanCard,
  BillingDowngradeDialog,
  BillingPageHeader,
  BillingPaymentHistoryCard,
  BillingSubscriptionManagementCard,
  BillingSuccessBanner,
  BillingVerifyingUpgradeState,
  BillingWorkflowCard,
} from "./billing-page-sections";

vi.mock("@/components/ui/workflow-guidance", () => ({
  WorkflowGuidance: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions: Array<{ label: string }>;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span>{actions.map((action) => action.label).join(",")}</span>
    </div>
  ),
}));

const subscription: SubscriptionInfo = {
  id: "sub_1",
  planCode: "starter",
  status: "active",
  currentPeriodEnd: "2024-04-10T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  canceledAt: null,
};

const payment: PaymentRecord = {
  id: "pay_1",
  amountCents: 7900,
  currency: "usd",
  status: "succeeded",
  stripeInvoiceId: "in_1",
  createdAt: "2024-03-10T00:00:00.000Z",
};

const promo: PromoInfo = {
  code: "SAVE20",
  discountType: "percent_off",
  discountValue: 20,
  duration: "once",
  durationMonths: null,
};

describe("billing page sections", () => {
  it("renders the page header, workflow, success banner, and verifying state", () => {
    const onDismiss = vi.fn();

    render(
      <>
        <BillingPageHeader />
        <BillingWorkflowCard />
        <BillingSuccessBanner
          message="Your plan has been upgraded successfully!"
          onDismiss={onDismiss}
        />
        <BillingVerifyingUpgradeState />
      </>,
    );

    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Billing workflow")).toBeInTheDocument();
    expect(screen.getByText("Open Projects,Settings")).toBeInTheDocument();
    expect(screen.getByText("Verifying your upgrade...")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss billing success banner" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders plan, subscription, and payment history sections with actions", () => {
    const onUpgradePlan = vi.fn();
    const onOpenPortal = vi.fn();

    render(
      <>
        <BillingCurrentPlanCard
          currentPlanName="Starter"
          currentTier="starter"
          currentPlanPrice={79}
          subscription={subscription}
          creditsRemaining={7}
          crawlsTotal={10}
          creditsPercentUsed={30}
          crawlsUsed={3}
          maxProjects={5}
          maxPagesPerCrawl={100}
          nextPlanTier="pro"
          onUpgradePlan={onUpgradePlan}
        />
        <BillingSubscriptionManagementCard
          subscription={subscription}
          currentTier="starter"
          nextPlanTier="pro"
          portalLoading={false}
          cancelDialogOpen={false}
          canceling={false}
          onOpenPortal={onOpenPortal}
          onCancelDialogOpenChange={vi.fn()}
          onCancelSubscription={vi.fn()}
          onChoosePlan={vi.fn()}
        />
        <BillingPaymentHistoryCard
          payments={[payment]}
          onOpenPortal={onOpenPortal}
        />
      </>,
    );

    expect(screen.getByText("Starter Plan")).toBeInTheDocument();
    expect(screen.getByText("7 of 10 remaining")).toBeInTheDocument();
    expect(screen.getByText("Subscription Management")).toBeInTheDocument();
    expect(screen.getByText("$79.00 USD")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade Plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Manage in Stripe" }));
    fireEvent.click(screen.getByRole("button", { name: "View all in Stripe" }));

    expect(onUpgradePlan).toHaveBeenCalledTimes(1);
    expect(onOpenPortal).toHaveBeenCalledTimes(2);
  });

  it("renders the cancel subscription dialog actions", () => {
    const onCancelSubscription = vi.fn();

    render(
      <BillingSubscriptionManagementCard
        subscription={subscription}
        currentTier="starter"
        nextPlanTier="pro"
        portalLoading={false}
        cancelDialogOpen
        canceling={false}
        onOpenPortal={vi.fn()}
        onCancelDialogOpenChange={vi.fn()}
        onCancelSubscription={onCancelSubscription}
        onChoosePlan={vi.fn()}
      />,
    );

    expect(screen.getByText("Cancel subscription?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));

    expect(onCancelSubscription).toHaveBeenCalledTimes(1);
  });

  it("renders available plans and promo actions", () => {
    const onPlanAction = vi.fn();
    const onPromoCodeChange = vi.fn();
    const onValidatePromo = vi.fn();

    render(
      <BillingAvailablePlansCard
        currentTier="starter"
        upgrading={null}
        promoCode="SAVE20"
        promoValid={promo}
        promoError={null}
        validatingPromo={false}
        onPlanAction={onPlanAction}
        onPromoCodeChange={onPromoCodeChange}
        onValidatePromo={onValidatePromo}
      />,
    );

    expect(screen.getByText("Available Plans")).toBeInTheDocument();
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Promo code"), {
      target: { value: "SAVE10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Upgrade" })[0]);

    expect(onPromoCodeChange).toHaveBeenCalledWith("SAVE10");
    expect(onValidatePromo).toHaveBeenCalledTimes(1);
    expect(onPlanAction).toHaveBeenCalledTimes(1);
  });

  it("renders downgrade dialog interactions", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <BillingDowngradeDialog
        open
        downgradingTo={null}
        canceling={false}
        downgrading={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Downgrade to Free?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep Current Plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Downgrade to Free" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
