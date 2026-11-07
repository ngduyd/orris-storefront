import { describe, expect, it } from "vitest";
import { canAccessOrder } from "@/lib/order-access";

const order = { userId: "user-1", email: "buyer@example.com" };
const base = { id: "user-1", email: "buyer@example.com", role: "customer" };

describe("order access", () => {
  it("owner sees their order", () => {
    expect(canAccessOrder({ ...base, emailVerifiedAt: null }, order)).toBe(true);
  });

  it("manager sees any order", () => {
    expect(canAccessOrder({ id: "staff", email: "staff@example.com", role: "manager", emailVerifiedAt: null }, order)).toBe(true);
  });

  it("email match requires a verified email (no account takeover by registering the address)", () => {
    const stranger = { id: "user-2", email: "buyer@example.com", role: "customer", emailVerifiedAt: null };
    expect(canAccessOrder(stranger, order)).toBe(false);
    expect(canAccessOrder({ ...stranger, emailVerifiedAt: new Date() }, order)).toBe(true);
  });

  it("case-insensitive email match, different account", () => {
    const other = { id: "user-3", email: "BUYER@example.com", role: "customer", emailVerifiedAt: new Date() };
    expect(canAccessOrder(other, order)).toBe(true);
  });

  it("guest order: only a verified matching email or a manager", () => {
    const guest = { userId: null, email: "guest@example.com" };
    expect(canAccessOrder({ id: "x", email: "guest@example.com", role: "customer", emailVerifiedAt: null }, guest)).toBe(false);
    expect(canAccessOrder({ id: "x", email: "guest@example.com", role: "customer", emailVerifiedAt: new Date() }, guest)).toBe(true);
    expect(canAccessOrder(null, guest)).toBe(false);
  });
});
