import { afterEach, describe, expect, it } from "vitest";
import { couponDiscount, shippingFor } from "@/lib/orders";
import { db } from "@/db";
import { coupons } from "@/db/schema";

afterEach(() => {
  delete process.env.SHIPPING_FLAT_MINOR;
  delete process.env.FREE_SHIPPING_OVER_MINOR;
});

describe("shipping", () => {
  it("free when nothing is configured", () => {
    expect(shippingFor(10000)).toBe(0);
  });

  it("flat fee below the threshold, free above it", () => {
    process.env.SHIPPING_FLAT_MINOR = "1500";
    process.env.FREE_SHIPPING_OVER_MINOR = "20000";
    expect(shippingFor(19999)).toBe(1500);
    expect(shippingFor(20000)).toBe(0);
  });
});

describe("coupons", () => {
  it("no code means no discount", async () => {
    expect(await couponDiscount(null, 10000)).toEqual({ ok: true, discountMinor: 0, code: null });
  });

  it("unknown or inactive codes are rejected", async () => {
    expect(await couponDiscount("NOPE", 10000)).toEqual({ ok: false });
    await db.insert(coupons).values({ code: "OFF20", percent: 20, active: false }).onConflictDoNothing();
    expect(await couponDiscount("off20", 10000)).toEqual({ ok: false });
  });

  it("applies percent to the subtotal and upper-cases the code", async () => {
    await db.insert(coupons).values({ code: "ORRIS15", percent: 15, active: true }).onConflictDoUpdate({ target: coupons.code, set: { active: true, percent: 15 } });
    expect(await couponDiscount(" orris15 ", 10000)).toEqual({ ok: true, discountMinor: 1500, code: "ORRIS15" });
  });

  it("never discounts more than 90%", async () => {
    await db.insert(coupons).values({ code: "FREE99", percent: 99, active: true }).onConflictDoUpdate({ target: coupons.code, set: { active: true, percent: 99 } });
    expect(await couponDiscount("FREE99", 10000)).toEqual({ ok: true, discountMinor: 9000, code: "FREE99" });
  });
});
