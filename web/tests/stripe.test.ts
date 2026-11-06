import { describe, expect, it } from "vitest";
import Stripe from "stripe";

// khoá giả: chỉ dùng để ký/verify offline, không gọi mạng
const stripe = new Stripe("sk_test_dummy");
const secret = "whsec_test_secret";

const payload = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1", payment_status: "paid", metadata: { orderId: "order-1" } } },
});

describe("webhook signature", () => {
  it("chấp nhận chữ ký hợp lệ và đọc đúng orderId", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.type).toBe("checkout.session.completed");
    expect(event.data.object).toMatchObject({ metadata: { orderId: "order-1" } });
  });

  it("từ chối khi body bị sửa", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload.replace("order-1", "order-2"), header, secret)).toThrow();
  });

  it("từ chối khi sai secret", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow();
  });
});
