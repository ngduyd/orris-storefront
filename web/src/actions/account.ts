"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, currentUser, signIn, signOut } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { consumeToken, issueToken, pruneTokens } from "@/lib/tokens";
import { currentUser } from "@/lib/auth";
import { clearFailures, clientIp, hit, noteFailure, tooMany } from "@/lib/rate-limit";

const credentials = z.object({
  email: z.email().max(120).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8).max(200),
});

const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/account");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function customerLoginAction(fd: FormData) {
  const next = safeNext(fd.get("next"));
  const parsed = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) redirect(`/account/login?error=1&next=${encodeURIComponent(next)}`);

  const key = `login:${parsed.data.email}`;
  if (tooMany(key)) redirect(`/account/login?error=slow&next=${encodeURIComponent(next)}`);

  const user = await signIn(parsed.data.email, parsed.data.password);
  if (!user) {
    noteFailure(key);
    redirect(`/account/login?error=1&next=${encodeURIComponent(next)}`);
  }
  clearFailures(key);
  redirect(next);
}

export async function registerAction(fd: FormData) {
  const next = safeNext(fd.get("next"));
  const parsed = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) redirect(`/account/register?error=format&next=${encodeURIComponent(next)}`);

  // public sign-up: one address cannot create accounts in a loop
  if (hit(`register:${await clientIp()}`, 5, HOUR)) redirect(`/account/register?error=slow&next=${encodeURIComponent(next)}`);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) redirect(`/account/register?error=taken&next=${encodeURIComponent(next)}`);

  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    role: "customer",
  });
  await signIn(parsed.data.email, parsed.data.password);

  await pruneTokens();
  const token = await issueToken(id, "verify", DAY);
  await sendMail({
    to: parsed.data.email,
    subject: "Verify your ORRIS email",
    text: `Confirm your email address:\n\n${await origin()}/account/verify?token=${token}\n\nThe link expires in 24 hours.`,
  });

  redirect(next);
}

export async function logoutAction() {
  await signOut();
  redirect("/");
}

// backward-compatible alias so callers stay unchanged
export const customerLogoutAction = logoutAction;

export async function forgotAction(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const parsed = z.email().max(120).safeParse(email);
  if (!parsed.success) redirect("/account/forgot?error=format");

  // two limits: the address that floods us, and the one email address being hammered
  if (hit(`forgot-ip:${await clientIp()}`, 5, HOUR) || hit(`forgot:${email}`, 3, HOUR)) redirect("/account/forgot?error=slow");

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  // always report success so account existence never leaks
  if (user) {
    await pruneTokens();
    const token = await issueToken(user.id, "reset", HOUR);
    await sendMail({
      to: email,
      subject: "Reset your ORRIS password",
      text: `Open the link to set a new password:\n\n${await origin()}/account/reset?token=${token}\n\nThe link expires in 1 hour. If this wasn't you, ignore this email.`,
    });
  }
  redirect("/account/forgot?sent=1");
}

export async function resetAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirect(`/account/reset?token=${encodeURIComponent(token)}&error=format`);

  const userId = await consumeToken(token, "reset");
  if (!userId) redirect("/account/reset?error=expired");

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId)); // changing the password signs the account out everywhere
  redirect("/account/login?reset=1");
}

export async function resendVerifyAction() {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const [row] = await db.select({ verified: users.emailVerifiedAt }).from(users).where(eq(users.id, user.id)).limit(1);
  if (row?.verified) redirect("/account?verify=ok");

  await pruneTokens();
  const token = await issueToken(user.id, "verify", DAY);
  await sendMail({
    to: user.email,
    subject: "Verify your ORRIS email",
    text: `Confirm your email address:\n\n${await origin()}/account/verify?token=${token}\n\nThe link expires in 24 hours.`,
  });
  redirect("/account?verify=sent");
}

export async function changePasswordAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/account/login");

  const currentPassword = String(fd.get("currentPassword") ?? "");
  const newPassword = String(fd.get("newPassword") ?? "");
  if (newPassword.length < 8) redirect("/account?pw=short");

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row?.hash) redirect("/account?pw=google"); // Google-only account
  if (!(await verifyPassword(currentPassword, row.hash))) redirect("/account?pw=wrong");

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), sessionId ? ne(sessions.id, sessionId) : undefined));
  redirect("/account?pw=ok");
}

export async function verifyEmailAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const userId = await consumeToken(token, "verify");
  if (!userId) redirect("/account?verify=expired");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  redirect("/account?verify=ok");
}
