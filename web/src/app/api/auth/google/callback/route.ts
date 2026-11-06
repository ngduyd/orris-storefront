import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { exchangeCode, googleEnabled } from "@/lib/google";

import { headers } from "next/headers";

/** Origin theo Host thật (tailnet/https), không theo URL nội bộ của Next. */
async function requestOrigin(fallback: string) {
  const h = await headers();
  const host = h.get("host") ?? new URL(fallback).host;
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  return `${proto}://${host}`;
}


/**
 * Bước 2: đổi code lấy profile, tìm hoặc tạo user, mở session.
 * Tài khoản email+mật khẩu cùng email sẽ được nối vào Google (email Google đã xác thực).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = await requestOrigin(req.url);
  const fail = (why: string) => Response.redirect(`${origin}/account/login?error=${why}`, 302);

  if (!googleEnabled) return fail("google");

  const jar = await cookies();
  const state = jar.get("oauth_state")?.value;
  const next = jar.get("oauth_next")?.value ?? "/account";
  jar.delete("oauth_state");
  jar.delete("oauth_next");

  if (!state || url.searchParams.get("state") !== state) return fail("state");
  const code = url.searchParams.get("code");
  if (!code) return fail("google");

  const profile = await exchangeCode(origin, code);
  if (!profile) return fail("google");

  const [byProvider] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.providerId, profile.sub))
    .limit(1);

  let userId = byProvider?.id;

  if (!userId) {
    const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, profile.email)).limit(1);
    if (byEmail) {
      userId = byEmail.id;
      await db
        .update(users)
        .set({
          provider: "google",
          providerId: profile.sub,
          emailVerifiedAt: profile.emailVerified ? new Date() : null,
        })
        .where(eq(users.id, userId));
    } else {
      userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: profile.email,
        name: profile.name,
        role: "customer",
        provider: "google",
        providerId: profile.sub,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
      });
    }
  }

  await createSession(userId);
  return Response.redirect(`${origin}${next.startsWith("/") ? next : "/account"}`, 302);
}
