import { headers } from "next/headers";

/**
 * `secure` phải theo giao thức thật của request, không theo NODE_ENV.
 * `next start` đặt NODE_ENV=production, nên nếu dựa vào nó thì cookie bị browser
 * từ chối khi xem qua http://<tailnet-ip>:3000 (localhost vẫn lọt nên test dễ sai).
 */
export async function isHttps() {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  return proto === "https" || (h.get("origin") ?? "").startsWith("https://");
}
