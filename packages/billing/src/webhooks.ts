import { billingQueries, userQueries, promoQueries } from "@llm-boost/db";
import { type PlanTier } from "@llm-boost/shared";
import type { Database } from "@llm-boost/db";
import { StripeGateway, type StripeEvent } from "./gateway";
import { planCodeFromPriceId } from "./plan-map";

// ---------------------------------------------------------------------------
// Main webhook dispatcher
// ---------------------------------------------------------------------------

export async function handleWebhook(
  event: StripeEvent,
  db: Database,
  stripeSecretKey: string,
): Promise<void> {
  const billing = billingQueries(db);
  const usersQ = userQueries(db);
  const gateway = new StripeGateway(stripeSecretKey);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object,
        billing,
        usersQ,
        gateway,
        db,
      );
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object, billing);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object, billing);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, billing, usersQ);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, billing, usersQ);
      break;
    default:
      // Unhandled event type — ignore silently
      break;
  }
}

// ---------------------------------------------------------------------------
// Event type helpers
// ---------------------------------------------------------------------------

type BillingQ = ReturnType<typeof billingQueries>;
type UsersQ = ReturnType<typeof userQueries>;

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  data: Record<string, unknown>,
  billing: BillingQ,
  usersQ: UsersQ,
  gateway: StripeGateway,
  db: Database,
): Promise<void> {
  const userId = data.client_reference_id as string | undefined;
  if (!userId) {
    throw new Error("checkout.session.completed missing client_reference_id");
  }

  const stripeSubId = data.subscription as string | undefined;
  if (!stripeSubId) {
    throw new Error("checkout.session.completed missing subscription");
  }

  const customerId = data.customer as string;

  // Fetch the full subscription from Stripe to get metadata.plan_code
  const stripeSub = await gateway.getSubscription(stripeSubId);
  const planCode = stripeSub.metadata.plan_code;
  if (!planCode) {
    throw new Error("Subscription metadata missing plan_code");
  }

  // Handle upgrade: cancel old subscription if upgrade_from_subscription_id in metadata
  const upgradeFromSubId = stripeSub.metadata.upgrade_from_subscription_id;
  if (upgradeFromSubId) {
    try {
      await gateway.cancelImmediately(upgradeFromSubId);
      await billing.cancelSubscription(upgradeFromSubId, new Date());
    } catch {
      // Old subscription may already be canceled — continue
    }
  }

  // Create local subscription record
  await billing.createSubscription({
    userId,
    planCode,
    status: "active",
    stripeSubscriptionId: stripeSubId,
    stripeCustomerId: customerId,
  });

  // Update user plan and crawl credits
  await usersQ.updatePlan(userId, planCode as PlanTier, stripeSubId);

  // Persist Stripe customer ID on user for portal access
  const user = await usersQ.getById(userId);
  if (user && !user.stripeCustomerId) {
    await usersQ.updateProfile(userId, { stripeCustomerId: customerId });
  }

  // Increment promo redemption if a discount was applied
  const discount = data.discount as { coupon?: { id?: string } } | null;
  if (discount?.coupon?.id) {
    const promosQ = promoQueries(db);
    const allPromos = await promosQ.list();
    const matchingPromo = allPromos.find(
      (p) => p.stripeCouponId === discount.coupon!.id,
    );
    if (matchingPromo) {
      await promosQ.incrementRedeemed(matchingPromo.id);
    }
  }
}

// ---------------------------------------------------------------------------
// invoice.payment_succeeded
// ---------------------------------------------------------------------------

async function handlePaymentSucceeded(
  data: Record<string, unknown>,
  billing: BillingQ,
): Promise<void> {
  const invoiceId = data.id as string;
  const amountPaid = data.amount_paid as number;
  const currency = (data.currency as string) ?? "usd";

  // Extract subscription ID from invoice lines
  const lines = data.lines as {
    data: Array<{
      parent?: {
        type: string;
        subscription_item_details?: {
          subscription: string;
        };
      } | null;
    }>;
  };

  let stripeSubId: string | undefined;
  if (lines?.data?.[0]?.parent?.subscription_item_details?.subscription) {
    stripeSubId = lines.data[0].parent.subscription_item_details.subscription;
  }

  // Idempotent check: skip if payment already recorded
  const existing = await billing.getPaymentByInvoiceId(invoiceId);
  if (existing) {
    return;
  }

  // Find local subscription to link the payment and get userId
  let localSubscription:
    | Awaited<ReturnType<typeof billing.getSubscriptionByStripeId>>
    | undefined;
  if (stripeSubId) {
    localSubscription =
      (await billing.getSubscriptionByStripeId(stripeSubId)) ?? undefined;
  }

  if (!localSubscription) {
    // Cannot find subscription — skip recording
    return;
  }

  // Sync period dates from Stripe invoice
  const periodStart = data.period_start as number | undefined;
  const periodEnd = data.period_end as number | undefined;
  if (stripeSubId && periodStart && periodEnd) {
    await billing.updateSubscriptionPeriod(
      stripeSubId,
      new Date(periodStart * 1000),
      new Date(periodEnd * 1000),
    );
  }

  // Record payment
  await billing.createPayment({
    userId: localSubscription.userId,
    subscriptionId: localSubscription.id,
    stripeInvoiceId: invoiceId,
    amountCents: amountPaid,
    currency,
    status: "succeeded",
  });
}

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------

async function handlePaymentFailed(
  data: Record<string, unknown>,
  billing: BillingQ,
): Promise<void> {
  // Extract subscription ID from invoice lines
  const lines = data.lines as {
    data: Array<{
      parent?: {
        type: string;
        subscription_item_details?: {
          subscription: string;
        };
      } | null;
    }>;
  };

  let stripeSubId: string | undefined;
  if (lines?.data?.[0]?.parent?.subscription_item_details?.subscription) {
    stripeSubId = lines.data[0].parent.subscription_item_details.subscription;
  }

  if (!stripeSubId) {
    return;
  }

  // Mark subscription as past_due
  await billing.updateSubscriptionStatus(stripeSubId, "past_due");
}

// ---------------------------------------------------------------------------
// customer.subscription.updated
// ---------------------------------------------------------------------------

async function handleSubscriptionUpdated(
  data: Record<string, unknown>,
  billing: BillingQ,
  usersQ: UsersQ,
): Promise<void> {
  const stripeSubId = data.id as string;
  const cancelAtPeriodEnd = data.cancel_at_period_end as boolean;

  // Sync cancel_at_period_end
  if (cancelAtPeriodEnd) {
    await billing.markCancelAtPeriodEnd(stripeSubId);
  }

  // Sync plan changes from price ID
  const items = data.items as {
    data: Array<{
      price: { id: string };
    }>;
  };

  if (items?.data?.[0]) {
    const priceId = items.data[0].price.id;
    const planCode = planCodeFromPriceId(priceId);

    if (planCode) {
      // Find local subscription and update the user's plan
      const localSub = await billing.getSubscriptionByStripeId(stripeSubId);
      if (localSub) {
        // Update subscription status based on Stripe status
        const stripeStatus = data.status as string;
        const mappedStatus = mapStripeStatus(stripeStatus);
        if (mappedStatus) {
          await billing.updateSubscriptionStatus(stripeSubId, mappedStatus);
        }

        await usersQ.updatePlan(
          localSub.userId,
          planCode as PlanTier,
          stripeSubId,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------

async function handleSubscriptionDeleted(
  data: Record<string, unknown>,
  billing: BillingQ,
  usersQ: UsersQ,
): Promise<void> {
  const stripeSubId = data.id as string;

  // Cancel subscription locally
  await billing.cancelSubscription(stripeSubId, new Date());

  // Downgrade user to free
  const localSub = await billing.getSubscriptionByStripeId(stripeSubId);
  if (localSub) {
    await usersQ.updatePlan(localSub.userId, "free", undefined);
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function mapStripeStatus(
  stripeStatus: string,
): "active" | "trialing" | "past_due" | "canceled" | undefined {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return undefined;
  }
}
