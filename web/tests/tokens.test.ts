import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consumeToken, issueToken } from "@/lib/tokens";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function newUser() {
  const id = randomUUID();
  await db.insert(users).values({ id, email: `tok-${id.slice(0, 8)}@example.com`, role: "customer" });
  return id;
}

describe("tokens", () => {
  it("works once, then is dead", async () => {
    const userId = await newUser();
    const token = await issueToken(userId, "verify", 60_000);
    expect(await consumeToken(token, "verify")).toBe(userId);
    expect(await consumeToken(token, "verify")).toBeNull();
  });

  it("refuses the wrong kind and an expired token", async () => {
    const userId = await newUser();
    const reset = await issueToken(userId, "reset", 60_000);
    expect(await consumeToken(reset, "verify")).toBeNull();
    const stale = await issueToken(userId, "verify", -1000);
    expect(await consumeToken(stale, "verify")).toBeNull();
  });

  it("a garbage token is rejected without throwing", async () => {
    expect(await consumeToken("not-a-token", "reset")).toBeNull();
  });

  it("only the hash is stored, never the raw token", async () => {
    const userId = await newUser();
    const token = await issueToken(userId, "verify", 60_000);
    const raw = await db.execute<{ n: number }>(`select count(*)::int as n from tokens where id = '${token}'`);
    expect(raw.rows[0].n).toBe(0);
    await db.delete(users).where(eq(users.id, userId));
  });
});
