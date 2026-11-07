import { describe, expect, it } from "vitest";
import { discountPercent, onSale, usd, usdMinor } from "@/lib/money";

describe("sale", () => {
  it("chỉ tính sale khi giá gốc lớn hơn giá bán", () => {
    expect(onSale({ priceMinor: 20500, compareAtMinor: 30000 })).toBe(true);
    expect(onSale({ priceMinor: 20500, compareAtMinor: 20500 })).toBe(false);
    expect(onSale({ priceMinor: 20500, compareAtMinor: 10000 })).toBe(false);
    expect(onSale({ priceMinor: 20500, compareAtMinor: null })).toBe(false);
  });

  it("phần trăm giảm làm tròn xuống", () => {
    expect(discountPercent({ priceMinor: 20500, compareAtMinor: 30000 })).toBe(31);
    expect(discountPercent({ priceMinor: 5000, compareAtMinor: 10000 })).toBe(50);
    expect(discountPercent({ priceMinor: 10000, compareAtMinor: null })).toBe(0);
  });

  it("quy đổi SAR -> USD giữ nguyên cách tính tiền", () => {
    expect(usd(20500)).toBe("$54.67");
    expect(usdMinor(20500)).toBe(5467);
  });
});
