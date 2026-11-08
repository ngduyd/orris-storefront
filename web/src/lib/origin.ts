import { headers } from "next/headers";

/**
 * Public origin of the current request.
 * SITE_URL wins when set: behind nginx/Cloudflare the Host header the app receives can be the
 * internal address (0.0.0.0:3000), which would leak into Stripe return URLs and email links.
 */
export function originFromHeaders(h: Headers): string {
  const site = process.env.SITE_URL?.trim();
  if (site) return site.replace(/\/+$/, "");

  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function requestOrigin(): Promise<string> {
  return originFromHeaders(await headers());
}
