import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { authorizeUrl, googleEnabled } from "@/lib/google";
import { isHttps } from "@/lib/cookie-secure";

import { headers } from "next/headers";

/** Origin from the real Host header (tailnet/https), not Next's internal URL. */
async function requestOrigin(fallback: string) {
  const h = await headers();
  const host = h.get("host") ?? new URL(fallback).host;
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  return `${proto}://${host}`;
}


const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/account");


/** Step 1: mint state, store it in a short-lived cookie, redirect to Google. */
export async function GET(req: Request) {
  if (!googleEnabled) return Response.redirect(new URL("/account/login?error=google", req.url), 302);

  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: 600,
  });

  jar.set("oauth_next", safeNext(new URL(req.url).searchParams.get("next")), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: 600,
  });

  const origin = await requestOrigin(req.url);
  return Response.redirect(authorizeUrl(origin, state), 302);
}
