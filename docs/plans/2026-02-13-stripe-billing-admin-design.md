# Stripe Billing + Admin Analytics — Design

## Goal

Integrate comprehensive Stripe subscription billing and admin analytics into LLM Rank, reusing patterns from the llmrank FastAPI project adapted to our TypeScript/Drizzle/Workers stack.

## Current State

- Basic Stripe integration exists in `packages/api/src/routes/billing.ts` (checkout, portal, 3 webhook events)
- Billing state lives on `users` table: `plan`, `stripeCustomerId`, `stripeSubId`, `crawlCreditsRemaining`
- Plan limits defined in `packages/shared/src/constants/plans.ts` (4 tiers)
- Settings page has plan comparison + upgrade buttons
- No payment history, no subscription lifecycle tracking, no admin dashboard

## What We're Adding

### 1. Database Schema (3 new tables)

**`subscriptions`** — full subscription lifecycle tracking
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | defaultRandom() |
| userId | uuid FK → users | |
| planCode | text | free/starter/pro/agency |
| status | enum | active, trialing, past_due, canceled |
| stripeSubscriptionId | text unique nullable | Stripe sub ID |
| stripeCustomerId | text nullable | Stripe customer ID |
| currentPeriodStart | timestamp nullable | Synced from Stripe |
| currentPeriodEnd | timestamp nullable | Synced from Stripe |
| cancelAtPeriodEnd | boolean | default false |
| canceledAt | timestamp nullable | |
| createdAt | timestamp | defaultNow() |

**`payments`** — every invoice payment recorded
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | defaultRandom() |
| userId | uuid FK → users | |
| subscriptionId | uuid FK → subscriptions nullable | |
| stripeInvoiceId | text unique | Idempotency key |
| amountCents | integer | |
| currency | text | default "usd" |
| status | enum | succeeded, pending, failed |
| createdAt | timestamp | defaultNow() |

**`plan_price_history`** — audit trail for price changes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | defaultRandom() |
| planCode | text | |
| oldPriceCents | integer | |
| newPriceCents | integer | |
| changedBy | uuid FK → users nullable | Admin who changed it |
| reason | text nullable | |
| changedAt | timestamp | defaultNow() |

Add `isAdmin` boolean to `users` table (default false).

Existing `users.plan`, `users.stripeCustomerId`, `users.stripeSubId` remain as "current state" cache.

### 2. New Package: `packages/billing`

**StripeGateway** — thin fetch-based Stripe API wrapper (no SDK, keeps Workers bundle small)

- `ensureCustomer(email, userId, existingCustomerId?)` → create or return Stripe customer
- `createCheckoutSession(customerId, priceId, metadata, successUrl, cancelUrl)` → session URL
- `createPortalSession(customerId, returnUrl)` → portal URL
- `cancelSubscriptionAtPeriodEnd(stripeSubId)` → void
- `getSubscription(stripeSubId)` → Stripe subscription object
- `constructWebhookEvent(body, signature, secret)` → verified event

**handleWebhook(event, db)** — dispatcher for 5 Stripe events:
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription row, update users.plan + stripeSubId |
| `invoice.payment_succeeded` | Record payment, sync period dates on subscription |
| `invoice.payment_failed` | Mark subscription past_due |
| `customer.subscription.updated` | Sync plan/status changes from Stripe |
| `customer.subscription.deleted` | Mark canceled, downgrade user to free |

**STRIPE_PLAN_MAP** — bidirectional mapping of Stripe price IDs to plan codes.

### 3. Admin Analytics (`packages/db/src/queries/admin.ts`)

Drizzle queries ported from llmrank's SQLAlchemy:

- `getMRR()` — SUM of active subscription prices (yearly / 12 for annuals)
- `getRevenueStats()` — total revenue, succeeded count, failed count
- `getBusinessMetrics()` — active customers, total customers, churn rate
- `getCustomerList(page, search?)` — paginated users with plan + subscription info

### 4. API Routes

**Enhanced billing routes (`/api/billing/*`):**

- Refactor existing checkout/portal/webhook to use StripeGateway
- `POST /cancel` — cancel subscription at period end
- `GET /payments` — user's payment history
- `GET /subscription` — current subscription with period dates

**New admin routes (`/api/admin/*`):**

- `GET /stats` — MRR, revenue, active subs, churn (single combined endpoint)
- `GET /customers` — paginated list with search + plan filter
- `GET /customers/:id` — detail with subscription + payment history
- Protected by `isAdmin` middleware check

### 5. Frontend

**New admin dashboard (`/dashboard/admin`):**

- 4 stat cards: MRR, total revenue, active subscribers, churn rate
- Customer table with search, plan badge, subscription status, last payment
- Click-through to customer detail (subscription history + payments)

**Payment history (new tab or section in Settings):**

- Table: date, amount, status badge, invoice link to Stripe

**Enhanced Settings billing section:**

- Subscription status (active/canceling) with period end date
- "Cancel Subscription" with confirmation dialog
- "Manage Billing" → Stripe Customer Portal

### 6. Deferred (YAGNI)

- Refunds — handled via Stripe Portal
- Plan CRUD admin — 4 static tiers, no dynamic management needed
- Transactional emails — defer to later phase
- Domain events bus — direct function calls suffice in Workers
- Yearly billing toggle — monthly only for now
- Price history admin UI — audit table exists, no viewer yet

## Architecture

```
packages/billing/          NEW
├── src/
│   ├── gateway.ts         StripeGateway (fetch-based)
│   ├── webhooks.ts        handleWebhook dispatcher
│   ├── plan-map.ts        Price ID ↔ plan code mapping
│   └── index.ts           Public exports

packages/db/
├── src/
│   ├── schema.ts          + subscriptions, payments, plan_price_history tables
│   ├── queries/admin.ts   NEW: MRR, revenue, churn, customer list
│   └── queries/billing.ts NEW: subscription + payment CRUD

packages/api/
├── src/
│   ├── routes/billing.ts  Refactored: uses StripeGateway + billing queries
│   ├── routes/admin.ts    NEW: admin analytics + customer management
│   └── middleware/admin.ts NEW: isAdmin guard

apps/web/
├── src/
│   ├── app/dashboard/admin/         NEW: admin dashboard
│   ├── app/dashboard/settings/      Enhanced: subscription management
│   └── lib/api.ts                   + admin + billing API methods
```

## Data Flow

```
User clicks "Upgrade to Pro"
  → POST /api/billing/checkout { plan: "pro" }
  → StripeGateway.createCheckoutSession()
  → Redirect to Stripe Checkout
  → User pays
  → Stripe sends checkout.session.completed webhook
  → POST /api/billing/webhook
  → handleWebhook():
      1. Create subscription row (status=active, planCode=pro)
      2. Update users.plan = "pro", users.stripeSubId = sub_xxx
      3. Reset crawl credits to pro tier limit
  → Stripe sends invoice.payment_succeeded
  → handleWebhook():
      1. Record payment (amount, invoice ID, status=succeeded)
      2. Sync currentPeriodStart/End on subscription
```
