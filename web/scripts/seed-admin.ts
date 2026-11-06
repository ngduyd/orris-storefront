import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email || password.length < 8) {
  console.error("Cần ADMIN_EMAIL và ADMIN_PASSWORD (>= 8 ký tự) trong .env.local");
  process.exit(1);
}

async function main() {
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db.update(users).set({ passwordHash, role: "manager" }).where(eq(users.id, existing.id));
    console.log(`Cập nhật manager ${email}`);
  } else {
    await db.insert(users).values({ id: randomUUID(), email, passwordHash, name: "Manager", role: "manager" });
    console.log(`Tạo manager ${email}`);
  }
}

// package.json không "type":"module" -> tsx coi file là CJS, không có top-level await
main().then(() => process.exit(0));
