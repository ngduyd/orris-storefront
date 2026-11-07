import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { tokens } from "@/db/schema";

const sha = (raw: string) => createHash("sha256").update(raw).digest("hex");

export type TokenKind = "reset" | "verify";

/** Returns the raw token (exists only in the email); the DB stores its hash. */
export async function issueToken(userId: string, kind: TokenKind, ttlMs: number) {
  const raw = randomBytes(32).toString("hex");
  await db.delete(tokens).where(and(eq(tokens.userId, userId), eq(tokens.kind, kind))); // one live token per kind
  await db.insert(tokens).values({ id: sha(raw), userId, kind, expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

/** Single use: delete and return userId when the token matches and has not expired. */
export async function consumeToken(raw: string, kind: TokenKind) {
  const id = sha(raw);
  const [row] = await db
    .delete(tokens)
    .where(and(eq(tokens.id, id), eq(tokens.kind, kind), gt(tokens.expiresAt, new Date())))
    .returning({ userId: tokens.userId });
  return row?.userId ?? null;
}

/** Prune expired tokens (called whenever a new token is issued). */
export async function pruneTokens() {
  await db.delete(tokens).where(lt(tokens.expiresAt, new Date()));
}
