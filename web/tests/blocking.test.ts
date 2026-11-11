import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { currentUser, setUserDisabled, signIn } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const password = "Blocked-pass-2026";
const created: string[] = [];

async function seedUser(email: string, role = "customer") {
  const id = randomUUID();
  created.push(id);
  await db.insert(users).values({ id, email, role, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() });
  return id;
}

async function seedSession(userId: string) {
  const id = randomUUID().replace(/-/g, "");
  await db.insert(sessions).values({ id, userId, expiresAt: new Date(Date.now() + 3_600_000) });
  return id;
}

const liveSessions = (userId: string) => db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));

afterAll(async () => {
  if (created.length) await db.delete(sessions).where(inArray(sessions.userId, created));
  if (created.length) await db.delete(users).where(inArray(users.id, created));
});

describe("blocking an account", () => {
  it("a live session stops counting as signed in, and is deleted", async () => {
    const userId = await seedUser(`block-a-${randomUUID().slice(0, 8)}@example.com`);
    const sessionId = await seedSession(userId);

    expect((await currentUser(sessionId))?.id).toBe(userId); // sanity: the session works first

    await setUserDisabled(userId, true);

    expect(await currentUser(sessionId)).toBeNull(); // the same cookie, now refused
    expect(await liveSessions(userId)).toEqual([]); // and it is gone, not merely ignored
  });

  it("a blocked account cannot sign in even with the right password", async () => {
    const email = `block-b-${randomUUID().slice(0, 8)}@example.com`;
    const userId = await seedUser(email);
    await setUserDisabled(userId, true);

    // "disabled" only after the password matched, so this says nothing to a guesser
    expect(await signIn(email, password)).toBe("disabled");
    expect(await signIn(email, "wrong-password")).toBeNull();
  });

  it("unblocking lets the account back in", async () => {
    const email = `block-c-${randomUUID().slice(0, 8)}@example.com`;
    const userId = await seedUser(email);
    await setUserDisabled(userId, true);
    await setUserDisabled(userId, false);

    const [row] = await db.select({ disabledAt: users.disabledAt }).from(users).where(eq(users.id, userId));
    expect(row.disabledAt).toBeNull();

    const sessionId = await seedSession(userId);
    expect((await currentUser(sessionId))?.id).toBe(userId);
  });

  it("blocking one account leaves the others alone", async () => {
    const victim = await seedUser(`block-d-${randomUUID().slice(0, 8)}@example.com`);
    const bystander = await seedUser(`block-e-${randomUUID().slice(0, 8)}@example.com`);
    const bystanderSession = await seedSession(bystander);
    await seedSession(victim);

    await setUserDisabled(victim, true);

    expect((await currentUser(bystanderSession))?.id).toBe(bystander);
    expect(await liveSessions(victim)).toEqual([]);
  });
});
