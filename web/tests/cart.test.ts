import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { addLine, readCart, removeLine, setLine } from "@/lib/cart";
import { db } from "@/db";
import { carts } from "@/db/schema";
import { eq } from "drizzle-orm";

const H = "mont-blanc-mont-blanc-explorer-100ml";
const H2 = "givenchy-givenchy-l-interdit-50ml";
const ids: string[] = [];
const newCart = () => {
  const id = randomUUID();
  ids.push(id);
  return id;
};

afterAll(async () => {
  for (const id of ids) await db.delete(carts).where(eq(carts.id, id));
});

describe("cart", () => {
  it("thêm 2 lần cùng handle thì cộng dồn qty", async () => {
    const c = newCart();
    await addLine(c, H, 1);
    await addLine(c, H, 2);
    const { lines, count } = await readCart(c);
    expect(lines).toHaveLength(1);
    expect(count).toBe(3);
  });

  it("tính tổng từ price_minor trong DB", async () => {
    const c = newCart();
    await addLine(c, H, 2);
    const { totalMinor, lines } = await readCart(c);
    expect(totalMinor).toBe(lines[0].priceMinor * 2);
  });

  it("setLine 0 thì xoá dòng", async () => {
    const c = newCart();
    await addLine(c, H, 1);
    await setLine(c, H, 0);
    expect((await readCart(c)).lines).toHaveLength(0);
  });

  it("chặn qty vượt 99", async () => {
    const c = newCart();
    await setLine(c, H, 500);
    expect((await readCart(c)).count).toBe(99);
  });

  it("handle không tồn tại không làm vỡ giỏ", async () => {
    const c = newCart();
    await addLine(c, "khong-co-that", 1);
    expect((await readCart(c)).lines).toHaveLength(0);
  });

  it("xoá 1 dòng không ảnh hưởng dòng khác", async () => {
    const c = newCart();
    await addLine(c, H, 1);
    await addLine(c, H2, 1);
    await removeLine(c, H);
    const { lines } = await readCart(c);
    expect(lines.map((l) => l.handle)).toEqual([H2]);
  });

  it("cart id rỗng/null trả giỏ rỗng, không query", async () => {
    expect((await readCart(null)).count).toBe(0);
  });
});
