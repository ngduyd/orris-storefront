import { headers } from "next/headers";

/**
 * `secure` must follow the request protocol, not NODE_ENV.
 * `next start` sets NODE_ENV=production, so keying off it makes the browser
 * drop the cookie on http://<tailnet-ip>:3000 (localhost still works, which hides the bug in tests).
 */
export async function isHttps() {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  return proto === "https" || (h.get("origin") ?? "").startsWith("https://");
}
