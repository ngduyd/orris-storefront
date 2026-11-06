/**
 * Giới hạn thử đăng nhập theo bộ nhớ tiến trình.
 * ponytail: 1 instance, reset khi restart. Đổi sang Redis khi chạy nhiều bản.
 */
const hits = new Map<string, { n: number; until: number }>();

export function tooMany(key: string, limit = 5, windowMs = 15 * 60 * 1000) {
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
