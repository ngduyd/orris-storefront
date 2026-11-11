import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { refundOrder } from "@/lib/orders";
import { stripe } from "@/lib/stripe";

/**
 * Opt-in: talks to the real Stripe test API and moves test money.
 * Run it with `STRIPE_SANDBOX=1 npx vitest run tests/sandbox-refund.test.ts`; the default `npm test`
 * and CI skip it, so a missing or expired key never breaks the suite.
 */
const live = Boolean(stripe && process.env.STRIPE_SANDBOX === "1");

const HANDLE = `test-sandbox-${randomUUID().slice(0, 8)}`;
const orderId = randomUUID();
const PIECE = 10_000; // SAR minor
const QTY = 2;

afterAll(async () => {
  if (!live) return;
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
  await db.delete(products).where(eq(products.handle, HANDLE));
});

describe.skipIf(!live)("refund against the Stripe sandbox", () => {
  it("a customer undoing a paid order produces exactly one real refund", async () => {
    // a real charge, the same shape checkout creates: confirmed PaymentIntent, test card
    const intent = await stripe!.paymentIntents.create({
      amount: PIECE * QTY,
      currency: "usd",
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    });
    expect(intent.status).toBe("succeeded");

    await db.insert(products).values({
      handle: HANDLE,
      title: "Sandbox Fixture",
      brand: "Fixture",
      gender: "Unisex",
      sizeMl: 50,
      priceMinor: PIECE,
      notes: { top: [], mid: [], base: [] },
      image: "fixture.webp",
      status: "active",
      stock: 100,
    });
    await db.insert(orders).values({
      id: orderId,
      email: `sandbox-${orderId.slice(0, 8)}@example.com`,
      status: "paid",
      paid: true,
      totalMinor: PIECE * QTY,
      stripePaymentIntent: intent.id,
      reservedUntil: null,
      stockReleased: false,
    });
    await db.insert(orderItems).values({ id: randomUUID(), orderId, handle: HANDLE, title: "Sandbox Fixture", qty: QTY, priceMinor: PIECE });
    await db.update(products).set({ stock: 100 - QTY }).where(eq(products.handle, HANDLE));

    // exactly what cancelMyOrderAction calls once selfCancelFor(status) === "refund"
    expect(await refundOrder(orderId, "customer:buyer@example.com")).toBe(true);

    const [after] = await db
      .select({ status: orders.status, paid: orders.paid, released: orders.stockReleased })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(after).toEqual({ status: "refunded", paid: false, released: true });

    const [stock] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, HANDLE));
    expect(stock.stock).toBe(100);

    const refunds = await stripe!.refunds.list({ payment_intent: intent.id, limit: 10 });
    expect(refunds.data).toHaveLength(1);
    expect(refunds.data[0].amount).toBe(PIECE * QTY);
    expect(refunds.data[0].status).toBe("succeeded");

    // a second click must not move money again
    expect(await refundOrder(orderId, "customer:buyer@example.com")).toBe(false);
    const twice = await stripe!.refunds.list({ payment_intent: intent.id, limit: 10 });
    expect(twice.data).toHaveLength(1);
  }, 60_000);
});
