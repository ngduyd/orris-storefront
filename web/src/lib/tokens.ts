import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { tokens } from "@/db/schema";

const sha = (raw: string) => createHash("sha256").update(raw).digest("hex");

export type TokenKind = "reset" | "verify";

/** Trả token gốc (chỉ tồn tại trong email); DB giữ hash. */
export async function issueToken(userId: string, kind: TokenKind, ttlMs: number) {
  const raw = randomBytes(32).toString("hex");
  await db.delete(tokens).where(and(eq(tokens.userId, userId), eq(tokens.kind, kind))); // mỗi loại 1 token sống
  await db.insert(tokens).values({ id: sha(raw), userId, kind, expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

/** Dùng một lần: đúng token + chưa hết hạn thì xoá và trả userId. */
export async function consumeToken(raw: string, kind: TokenKind) {
  const id = sha(raw);
  const [row] = await db
    .delete(tokens)
    .where(and(eq(tokens.id, id), eq(tokens.kind, kind), gt(tokens.expiresAt, new Date())))
    .returning({ userId: tokens.userId });
  return row?.userId ?? null;
}

/** Dọn token hết hạn (gọi kèm mỗi lần phát token mới). */
export async function pruneTokens() {
  await db.delete(tokens).where(lt(tokens.expiresAt, new Date()));
}
