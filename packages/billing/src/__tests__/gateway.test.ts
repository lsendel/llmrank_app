import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripeGateway } from "../gateway";

// ---------------------------------------------------------------------------
// Mock global fetch for Stripe API calls
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StripeGateway", () => {
  let gateway: StripeGateway;
  const SECRET_KEY = "sk_test_abc123";

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new StripeGateway(SECRET_KEY);
  });

  // -------------------------------------------------------------------------
  // ensureCustomer
  // -------------------------------------------------------------------------

  describe("ensureCustomer", () => {
    it("returns existing customer when valid", async () => {
      mockFetchResponse({ id: "cus_existing", object: "customer" });

      const result = await gateway.ensureCustomer(
        "user@test.com",
        "user-1",
        "cus_existing",
      );

      expect(result).toBe("cus_existing");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stripe.com/v1/customers/cus_existing",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("creates new customer when existing ID is invalid", async () => {
      // First call fails (existing customer not found)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { message: "No such customer" } }),
      });
      // Second call creates new customer
      mockFetchResponse({
        id: "cus_new",
        object: "customer",
        email: "user@test.com",
      });

      const result = await gateway.ensureCustomer(
        "user@test.com",
        "user-1",
        "cus_invalid",
      );

      expect(result).toBe("cus_new");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("creates new customer when no existing ID provided", async () => {
      mockFetchResponse({ id: "cus_brand_new", object: "customer" });

      const result = await gateway.ensureCustomer("user@test.com", "user-1");

      expect(result).toBe("cus_brand_new");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.stripe.com/v1/customers");
      expect(init.method).toBe("POST");
    });
  });

  // -------------------------------------------------------------------------
  // createCheckoutSession
  // -------------------------------------------------------------------------

  describe("createCheckoutSession", () => {
    it("creates session with correct params", async () => {
      mockFetchResponse({
        id: "cs_test_1",
        object: "checkout.session",
        url: "https://checkout.stripe.com/pay/cs_test_1",
      });

      const result = await gateway.createCheckoutSession({
        customerId: "cus_1",
        priceId: "price_pro",
        userId: "user-1",
        planCode: "pro",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      });

      expect(result.sessionId).toBe("cs_test_1");
      expect(result.url).toBe("https://checkout.stripe.com/pay/cs_test_1");

      const [, init] = mockFetch.mock.calls[0];
      const body = init.body as string;
      expect(body).toContain("mode=subscription");
      expect(body).toContain("customer=cus_1");
      expect(body).toContain("client_reference_id=user-1");
      expect(body).toContain(
        encodeURIComponent("line_items[0][price]") + "=price_pro",
      );
    });

    it("includes upgrade metadata when upgrading", async () => {
      mockFetchResponse({
        id: "cs_test_2",
        url: "https://checkout.stripe.com/pay/cs_test_2",
      });

      await gateway.createCheckoutSession({
        customerId: "cus_1",
        priceId: "price_agency",
        userId: "user-1",
        planCode: "agency",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
        upgradeFromSubscriptionId: "sub_old",
      });

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain("sub_old");
    });
  });

  // -------------------------------------------------------------------------
  // cancelAtPeriodEnd / cancelImmediately
  // -------------------------------------------------------------------------

  describe("cancelAtPeriodEnd", () => {
    it("sends cancel_at_period_end=true", async () => {
      mockFetchResponse({
        id: "sub_1",
        cancel_at_period_end: true,
      });

      await gateway.cancelAtPeriodEnd("sub_1");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.stripe.com/v1/subscriptions/sub_1");
      expect(init.method).toBe("POST");
      expect(init.body).toContain("cancel_at_period_end=true");
    });
  });

  describe("cancelImmediately", () => {
    it("sends DELETE request", async () => {
      mockFetchResponse({ id: "sub_1", status: "canceled" });

      await gateway.cancelImmediately("sub_1");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.stripe.com/v1/subscriptions/sub_1");
      expect(init.method).toBe("DELETE");
    });
  });

  // -------------------------------------------------------------------------
  // getSubscription
  // -------------------------------------------------------------------------

  describe("getSubscription", () => {
    it("fetches subscription by ID", async () => {
      mockFetchResponse({
        id: "sub_1",
        object: "subscription",
        status: "active",
        metadata: { plan_code: "pro" },
      });

      const result = await gateway.getSubscription("sub_1");

      expect(result.id).toBe("sub_1");
      expect(result.metadata.plan_code).toBe("pro");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({
            error: { message: "No such subscription: sub_invalid" },
          }),
      });

      await expect(gateway.getSubscription("sub_invalid")).rejects.toThrow(
        "No such subscription",
      );
    });
  });

  // -------------------------------------------------------------------------
  // verifyWebhookSignature
  // -------------------------------------------------------------------------

  describe("verifyWebhookSignature", () => {
    const webhookSecret = "whsec_test_secret";
    const payload = '{"id":"evt_1","type":"test"}';

    async function createValidSignature(
      payload: string,
      secret: string,
      timestamp: number,
    ): Promise<string> {
      const encoder = new TextEncoder();
      const signedPayload = `${timestamp}.${payload}`;
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(signedPayload),
      );
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `t=${timestamp},v1=${hex}`;
    }

    it("accepts valid signature", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const header = await createValidSignature(payload, webhookSecret, ts);

      const result = await gateway.verifyWebhookSignature(
        payload,
        header,
        webhookSecret,
      );

      expect(result.id).toBe("evt_1");
    });

    it("rejects missing t or v1 in header", async () => {
      await expect(
        gateway.verifyWebhookSignature(payload, "bad_header", webhookSecret),
      ).rejects.toThrow("missing t or v1");
    });

    it("rejects expired timestamp (>300s old)", async () => {
      const oldTs = Math.floor(Date.now() / 1000) - 600;
      const header = await createValidSignature(payload, webhookSecret, oldTs);

      await expect(
        gateway.verifyWebhookSignature(payload, header, webhookSecret),
      ).rejects.toThrow("too old or too far in the future");
    });

    it("rejects tampered payload", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const header = await createValidSignature(payload, webhookSecret, ts);

      await expect(
        gateway.verifyWebhookSignature(
          '{"id":"evt_tampered","type":"test"}',
          header,
          webhookSecret,
        ),
      ).rejects.toThrow("signature verification failed");
    });

    it("rejects wrong secret", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const header = await createValidSignature(payload, "whsec_wrong", ts);

      await expect(
        gateway.verifyWebhookSignature(payload, header, webhookSecret),
      ).rejects.toThrow("signature verification failed");
    });
  });

  // -------------------------------------------------------------------------
  // upgradeSubscriptionPrice
  // -------------------------------------------------------------------------

  describe("upgradeSubscriptionPrice", () => {
    it("sends proration_behavior=create_prorations", async () => {
      mockFetchResponse({
        id: "sub_1",
        object: "subscription",
        status: "active",
        items: { data: [{ id: "si_upgraded", price: { id: "price_agency" } }] },
      });

      const result = await gateway.upgradeSubscriptionPrice(
        "sub_1",
        "si_item1",
        "price_agency",
      );

      expect(result.id).toBe("sub_1");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.stripe.com/v1/subscriptions/sub_1");
      expect(init.method).toBe("POST");
      const body = init.body as string;
      expect(body).toContain("proration_behavior=create_prorations");
      expect(body).toContain(encodeURIComponent("items[0][id]") + "=si_item1");
      expect(body).toContain(
        encodeURIComponent("items[0][price]") + "=price_agency",
      );
    });
  });

  // -------------------------------------------------------------------------
  // createPortalSession
  // -------------------------------------------------------------------------

  describe("createPortalSession", () => {
    it("returns portal URL", async () => {
      mockFetchResponse({ url: "https://billing.stripe.com/portal/sess_1" });

      const url = await gateway.createPortalSession(
        "cus_1",
        "https://app.test/settings",
      );

      expect(url).toBe("https://billing.stripe.com/portal/sess_1");
    });
  });
});
