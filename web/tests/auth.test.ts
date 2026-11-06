import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("chấp nhận đúng mật khẩu, từ chối sai", async () => {
    const stored = await hashPassword("correct-horse-9");
    expect(await verifyPassword("correct-horse-9", stored)).toBe(true);
    expect(await verifyPassword("correct-horse-8", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("muối ngẫu nhiên: cùng mật khẩu, hash khác nhau", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("hash hỏng hoặc sai scheme thì từ chối, không ném lỗi", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt:aa:bb")).toBe(false);
    expect(await verifyPassword("x", "scrypt:zz:zz")).toBe(false);
  });
});
