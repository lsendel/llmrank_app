// ---------------------------------------------------------------------------
// Type interfaces for Stripe API responses
// ---------------------------------------------------------------------------

export interface StripeCheckoutSession {
  id: string;
  object: "checkout.session";
  url: string | null;
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  object: "subscription";
  customer: string;
  status:
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "trialing"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        product: string;
        unit_amount: number | null;
        currency: string;
      };
    }>;
  };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  metadata: Record<string, string>;
}

export interface StripeInvoice {
  id: string;
  object: "invoice";
  customer: string;
  subscription: string | null;
  amount_paid: number;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  lines: {
    data: Array<{
      id: string;
      amount: number;
      parent: {
        type: string;
        subscription_item_details?: {
          subscription: string;
        };
      } | null;
      price: {
        id: string;
      } | null;
    }>;
  };
  period_start: number;
  period_end: number;
}

export interface StripeCustomer {
  id: string;
  object: "customer";
  email: string | null;
  metadata: Record<string, string>;
}

export interface StripeEvent {
  id: string;
  object: "event";
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeFormData(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function stripeRequest<T>(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, string>,
): Promise<T> {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  const init: RequestInit = { method, headers };

  if (body && (method === "POST" || method === "PATCH")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeFormData(body);
  }

  const res = await fetch(url, init);
  const json = await res.json();

  if (!res.ok) {
    const errMsg =
      (json as { error?: { message?: string } }).error?.message ??
      `Stripe API error ${res.status}`;
    throw new Error(errMsg);
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Webhook signature verification (Web Crypto API for Cloudflare Workers)
// ---------------------------------------------------------------------------

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// StripeGateway class
// ---------------------------------------------------------------------------

export class StripeGateway {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  /**
   * Ensure a Stripe customer exists for the given user.
   * If existingCustomerId is provided and valid, returns it.
   * Otherwise creates a new customer with the user's email and userId metadata.
   */
  async ensureCustomer(
    email: string,
    userId: string,
    existingCustomerId?: string,
  ): Promise<string> {
    if (existingCustomerId) {
      try {
        const customer = await stripeRequest<StripeCustomer>(
          this.secretKey,
          "GET",
          `/customers/${existingCustomerId}`,
        );
        return customer.id;
      } catch {
        // Customer doesn't exist or was deleted — create a new one
      }
    }

    const customer = await stripeRequest<StripeCustomer>(
      this.secretKey,
      "POST",
      "/customers",
      {
        email,
        "metadata[user_id]": userId,
      },
    );
    return customer.id;
  }

  /**
   * Create a Stripe Checkout session for the given plan.
   */
  async createCheckoutSession(opts: {
    customerId: string;
    priceId: string;
    userId: string;
    planCode: string;
    successUrl: string;
    cancelUrl: string;
    upgradeFromSubscriptionId?: string;
  }): Promise<{ sessionId: string; url: string }> {
    const params: Record<string, string> = {
      mode: "subscription",
      customer: opts.customerId,
      client_reference_id: opts.userId,
      "line_items[0][price]": opts.priceId,
      "line_items[0][quantity]": "1",
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      "subscription_data[metadata][plan_code]": opts.planCode,
    };

    if (opts.upgradeFromSubscriptionId) {
      params["subscription_data[metadata][upgrade_from_subscription_id]"] =
        opts.upgradeFromSubscriptionId;
    }

    const session = await stripeRequest<StripeCheckoutSession>(
      this.secretKey,
      "POST",
      "/checkout/sessions",
      params,
    );

    return { sessionId: session.id, url: session.url! };
  }

  /**
   * Create a Stripe Billing Portal session for managing subscriptions.
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<string> {
    const result = await stripeRequest<{ url: string }>(
      this.secretKey,
      "POST",
      "/billing_portal/sessions",
      {
        customer: customerId,
        return_url: returnUrl,
      },
    );
    return result.url;
  }

  /**
   * Retrieve a Stripe subscription by ID.
   */
  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return stripeRequest<StripeSubscription>(
      this.secretKey,
      "GET",
      `/subscriptions/${subscriptionId}`,
    );
  }

  /**
   * Cancel a subscription at the end of the current billing period.
   */
  async cancelAtPeriodEnd(subscriptionId: string): Promise<StripeSubscription> {
    return stripeRequest<StripeSubscription>(
      this.secretKey,
      "POST",
      `/subscriptions/${subscriptionId}`,
      { cancel_at_period_end: "true" },
    );
  }

  /**
   * Cancel a subscription immediately.
   */
  async cancelImmediately(subscriptionId: string): Promise<void> {
    await stripeRequest<StripeSubscription>(
      this.secretKey,
      "DELETE",
      `/subscriptions/${subscriptionId}`,
    );
  }

  /**
   * Verify a Stripe webhook signature using Web Crypto API (HMAC-SHA256).
   * Parses the Stripe-Signature header, checks timestamp freshness (300s),
   * and compares the v1 signature.
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<StripeEvent> {
    // Parse the Stripe-Signature header: "t=...,v1=...,v0=..."
    const parts = signature.split(",");
    const sigMap: Record<string, string> = {};
    for (const part of parts) {
      const [key, value] = part.split("=", 2);
      if (key && value) {
        sigMap[key.trim()] = value.trim();
      }
    }

    const timestamp = sigMap["t"];
    const v1Signature = sigMap["v1"];

    if (!timestamp || !v1Signature) {
      throw new Error("Invalid Stripe-Signature header: missing t or v1");
    }

    // Check timestamp freshness (within 300 seconds)
    const tsNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - tsNum) > 300) {
      throw new Error("Webhook timestamp too old or too far in the future");
    }

    // Compute expected signature: HMAC-SHA256(secret, timestamp + "." + payload)
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload),
    );

    const expectedHex = uint8ArrayToHex(new Uint8Array(signatureBytes));

    // Constant-time comparison
    if (expectedHex.length !== v1Signature.length) {
      throw new Error("Webhook signature verification failed");
    }

    const a = encoder.encode(expectedHex);
    const b = encoder.encode(v1Signature);
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }

    if (diff !== 0) {
      throw new Error("Webhook signature verification failed");
    }

    return JSON.parse(payload) as StripeEvent;
  }
}
