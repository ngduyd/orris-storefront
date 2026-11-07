/** data/processed/products.csv -> bảng products. Chạy lại an toàn (upsert theo handle). */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { coupons, products } from "../src/db/schema";

const CSV = join(process.cwd(), "..", "data/processed/products.csv");
const IMG_DIR = join(process.cwd(), "..", "data", "images_norm");
// Local filenames are <handle>.<ext>, and the extension follows the magic bytes, so the directory
// is read when present. Without it (a deploy that ships only the CSV) the Cloudinary public id is
// still <handle>.webp, which is exactly what imageUrl() builds.
const images = new Map(existsSync(IMG_DIR) ? readdirSync(IMG_DIR).map((f) => [f.slice(0, f.lastIndexOf(".")), f]) : []);
const split = (s: string) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);

const rows = (parse(readFileSync(CSV, "utf8"), { columns: true, skip_empty_lines: true }) as Record<string, string>[])
  .map((r) => ({
    handle: r.handle,
    title: r.title,
    brand: r.brand,
    gender: r.gender,
    concentration: r.concentration || null,
    family: r.family || null,
    accords: split(r.accords),
    notes: { top: split(r.notes_top), mid: split(r.notes_mid), base: split(r.notes_base) },
    sizeMl: Number(r.size_ml),
    priceMinor: Math.round(Number(r.price_sar) * 100),
    rating: r.rating ? r.rating : null,
    ratingCount: r.rating_count ? Number(r.rating_count) : null,
    year: r.year ? Number(r.year) : null,
    description: r.description || null,
    // ảnh nguồn hỏng (1 SKU) -> để draft, không hiện trên storefront
    image: images.get(r.handle) ?? `${r.handle}.webp`,
    status: "active" as const,
    stock: 100,
  }));

async function main() {
  // demo coupon so the checkout code path is usable out of the box
  await db.insert(coupons).values({ code: "ORRIS15", percent: 15 }).onConflictDoUpdate({ target: coupons.code, set: { active: true, percent: 15 } });
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(products)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: products.handle,
        set: {
          title: sql`excluded.title`,
          brand: sql`excluded.brand`,
          priceMinor: sql`excluded.price_minor`,
          image: sql`excluded.image`,
          status: sql`excluded.status`,
          stock: sql`excluded.stock`,
          updatedAt: new Date(),
        },
      });
  }
  // xoá SKU không còn trong CSV (pipeline lọc thêm) để DB khớp nguồn
  await db.delete(products).where(sql`${products.handle} <> all(${sql.raw(`array[${rows.map((r) => `'${r.handle.replace(/'/g, "''")}'`).join(",")}]`)})`);

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(products);
  if (n !== rows.length) throw new Error(`DB có ${n}, CSV có ${rows.length}`);
  console.log(`seeded ${n} products`);
  process.exit(0);
}

main();
