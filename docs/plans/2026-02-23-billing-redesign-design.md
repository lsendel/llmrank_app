# Billing Redesign — Design Document

**Date:** 2026-02-23
**Status:** Approved
**Scope:** `apps/web`, `apps/api`, `packages/billing`

## Goal

Fix broken billing flows (checkout, portal, settings), add upgrade proration, and create a dedicated `/dashboard/billing` page with Stripe Customer Portal as the subscription management hub.

## Problems

1. **Checkout doesn't open** — Silent failures when `createCheckoutSession` API call fails (no error feedback to user)
2. **Customer Portal broken** — `stripeCustomerId` persistence was fixed in `d65041b` but the UX has no error handling if the portal call fails
3. **No proration on upgrades** — Currently creates a brand new subscription via Checkout, old one canceled in webhook. User pays full price regardless of remaining time.
4. **Billing UI buried** — Settings tab, not easily discoverable. No dedicated page.

## Design

### 1. Dedicated Billing Page (`/dashboard/billing`)

4 sections stacked vertically:

**Section 1: Current Plan Hero**

- Plan name + price + status badge (Active / Canceling / Past Due / Free)
- Next billing date, last payment date (from subscription period data)
- Usage progress bars: crawls used, projects used
- CTA: "Upgrade" or "Manage in Stripe"

**Section 2: Subscription Management**

- "Manage Subscription" button → Stripe Customer Portal (invoices, payment method, cancel)
- If no subscription: "You're on the Free plan" with upgrade prompt
- Cancel/downgrade controls with confirmation dialogs

**Section 3: Plan Comparison Grid**

- 4 plan cards (Free, Starter $79, Pro $149, Agency $299)
- Current plan highlighted, upgrade/downgrade buttons
- Promo code input

**Section 4: Payment History**

- Table: date, amount, status badge, invoice link
- "View all in Stripe" link to portal

### 2. Proration for Upgrades

When user already has an active subscription and upgrades:

- Use `gateway.updateSubscriptionPrice(subId, itemId, newPriceId)` with `proration_behavior: "create_prorations"` instead of creating a new Checkout session
- Stripe automatically charges the prorated difference
- Local DB updated immediately (same pattern as downgrade)

When user is on Free plan or has no subscription:

- Use existing Stripe Checkout flow (creates new subscription)

### 3. Downgrade Behavior (unchanged)

- `proration_behavior: "none"` — takes effect at next billing cycle
- Downgrade to Free = cancel at period end
- User keeps access through end of current period

### 4. Error Handling

- Toast notifications for all billing actions (success + failure)
- Loading states on all buttons
- Graceful fallbacks when subscription data is unavailable

### 5. Navigation Changes

- Add "Billing" to dashboard sidebar (between Settings and Admin)
- Settings billing tab → redirect to `/dashboard/billing` or removed
- Success banner after upgrade redirect (`?upgraded=true`)

## API Changes

### New endpoint: `POST /api/billing/upgrade`

Handles in-place upgrades for existing subscribers:

- Validates target plan is higher than current
- Calls `gateway.updateSubscriptionPrice` with `proration_behavior: "create_prorations"`
- Updates local DB immediately
- Returns `{ upgraded: true, targetPlan }`

Falls back to checkout flow if no active subscription.

### Modified: Checkout endpoint

- Only used for first-time subscribers (no existing Stripe subscription)
- Pass `upgradeFromSubscriptionId` in metadata for tracking

## Files Changed

```
apps/web/src/app/dashboard/billing/page.tsx     ← NEW — dedicated billing page
apps/web/src/app/dashboard/billing/layout.tsx    ← NEW — metadata
apps/web/src/app/dashboard/layout.tsx            ← MODIFY — add Billing to sidebar
apps/web/src/app/dashboard/settings/page.tsx     ← MODIFY — remove billing tab or redirect
apps/web/src/components/settings/billing-section.tsx ← MODIFY — simplify to link to /billing
apps/api/src/routes/billing.ts                   ← MODIFY — add /upgrade endpoint
apps/api/src/services/billing-service.ts         ← MODIFY — add upgrade() method
packages/billing/src/gateway.ts                  ← MODIFY — add upgradeSubscriptionPrice()
```

## Tech Stack

- Next.js App Router (existing)
- shadcn/ui components (existing: Card, Badge, Button, Dialog, Tabs)
- Stripe Customer Portal (existing gateway method)
- Stripe proration API (new: `proration_behavior: "create_prorations"`)
