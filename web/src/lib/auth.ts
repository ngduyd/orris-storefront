import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isHttps } from "@/lib/cookie-secure";


export const SESSION_COOKIE = "orris_admin";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Sign-in for any account (manager or customer). Roles are checked by callers. */
export async function signIn(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user?.passwordHash) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  await createSession(user.id);
  return user;
}

/** Shared by password and OAuth sign-in. */
export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ id, userId, expiresAt: new Date(Date.now() + TTL_MS) });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function signOut() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  jar.delete(SESSION_COOKIE);
}

/** Any signed-in account, customers included. */
export async function currentUser() {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, role: users.role, emailVerifiedAt: users.emailVerifiedAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function requireUser(next = "/account") {
  const user = await currentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function currentAdmin() {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** Staff: manager or carrier. */
export async function currentStaff() {
  const u = await currentUser();
  return u && (u.role === "manager" || u.role === "carrier") ? u : null;
}

export async function requireStaff() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}

/** Managers only: edit products, change order status, read sales. */
export async function requireManager() {
  const staff = await requireStaff();
  if (staff.role !== "manager") redirect("/admin/orders?denied=1");
  return staff;
}

export const canManage = (role: string) => role === "manager";
