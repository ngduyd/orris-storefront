"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { signIn, signOut } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { consumeToken, issueToken, pruneTokens } from "@/lib/tokens";
import { currentUser } from "@/lib/auth";
import { clearFailures, noteFailure, tooMany } from "@/lib/rate-limit";

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
    subject: "Xác thực email ORRIS",
    text: `Xác nhận địa chỉ email của bạn:\n\n${await origin()}/account/verify?token=${token}\n\nLink hết hạn sau 24 giờ.`,
  });

  redirect(next);
}

export async function logoutAction() {
  await signOut();
  redirect("/");
}

// alias cũ để không phải sửa chỗ khác
export const customerLogoutAction = logoutAction;

export async function forgotAction(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const parsed = z.email().max(120).safeParse(email);
  if (!parsed.success) redirect("/account/forgot?error=format");

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  // luôn báo thành công: không để lộ email nào có tài khoản
  if (user) {
    await pruneTokens();
    const token = await issueToken(user.id, "reset", HOUR);
    await sendMail({
      to: email,
      subject: "Đặt lại mật khẩu ORRIS",
      text: `Mở link để đặt mật khẩu mới:\n\n${await origin()}/account/reset?token=${token}\n\nLink hết hạn sau 1 giờ. Nếu không phải bạn, bỏ qua email này.`,
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
  await db.delete(sessions).where(eq(sessions.userId, userId)); // đổi mật khẩu = đăng xuất mọi nơi
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
    subject: "Xác thực email ORRIS",
    text: `Xác nhận địa chỉ email của bạn:\n\n${await origin()}/account/verify?token=${token}\n\nLink hết hạn sau 24 giờ.`,
  });
  redirect("/account?verify=sent");
}

export async function verifyEmailAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const userId = await consumeToken(token, "verify");
  if (!userId) redirect("/account?verify=expired");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  redirect("/account?verify=ok");
}
