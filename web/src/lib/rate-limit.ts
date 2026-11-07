import { headers } from "next/headers";

/**
 * Login attempt limiter kept in process memory.
 * ponytail: single instance, resets on restart. Move to Redis when running more than one copy.
 */
const hits = new Map<string, { n: number; until: number }>();

export function tooMany(key: string, limit = 5) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.until < now) return false;
  return row.n >= limit;
}

export function noteFailure(key: string, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.until < now) hits.set(key, { n: 1, until: now + windowMs });
  else row.n += 1;
}

export function clearFailures(key: string) {
  hits.delete(key);
}

/** Fixed-window counter: counts this call, returns true once the limit is reached. */
export function hit(key: string, limit: number, windowMs: number) {
  if (tooMany(key, limit)) return true;
  noteFailure(key, windowMs);
  return false;
}

/**
 * Client address, or null when nothing trustworthy is in front of us. x-real-ip is set by our proxy;
 * in x-forwarded-for the LAST hop is the nearest proxy, the first one is whatever the client sent.
 * Callers must skip the IP limit on null, never share one bucket between all visitors.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return hops.at(-1) ?? null;
}
