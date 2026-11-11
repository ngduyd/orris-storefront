/**
 * Believable demo orders, so the admin console does not read as "a test harness".
 *
 * Additive only: it inserts orders whose ids start with "demo" and upserts nothing else. Run it with
 * an explicit DATABASE_URL. Re-running replaces the demo rows, so the screenshots stay stable.
 *
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-demo-orders.ts
 */
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { orderItems, orders } from "../src/db/schema";

const DEMO_IDS = ["demo1a2b3c4d", "demo2b3c4d5e", "demo3c4d5e6f", "demo4d5e6f70", "demo5e6f7081", "demo6f708192"];

// products that exist in the catalogue; prices are the SAR minor units of those handles
const LINES = [
  { handle: "mancera-mancera-roses-vanille-120ml", title: "Roses Vanille 120ml", priceMinor: 40900, qty: 1 },
  { handle: "dior-dior-sauvage-edp-100ml", title: "Sauvage EDP 100ml", priceMinor: 43000, qty: 2 },
  { handle: "carolina-herrera-carolina-herrera-212-nyc-100ml", title: "212 Nyc 100ml", priceMinor: 24900, qty: 1 },
  { handle: "van-cleef-arpels-van-cleef-arpels-so-first-100ml", title: "So First 100ml", priceMinor: 23300, qty: 1 },
];

const DEMOS = [
  {
    id: DEMO_IDS[0], email: "linh.tran@example.com", customerName: "Linh Tran",
    address: "42 Rue Saint-Honoré, 75001 Paris, France", phone: "+33 6 12 44 88 02",
    status: "delivered" as const, paid: true, carrier: "DHL Express", trackingCode: "JD0146000037",
    lines: [0, 1], daysAgo: 9, shippingMinor: 1500,
  },
  {
    id: DEMO_IDS[1], email: "marcus.webb@example.com", customerName: "Marcus Webb",
    address: "18 Prince Street, Brooklyn, NY 11201, USA", phone: "+1 917 555 0143",
    status: "shipped" as const, paid: true, carrier: "FedEx", trackingCode: "7749 2231 8890",
    lines: [2], daysAgo: 4, shippingMinor: 0,
  },
  {
    id: DEMO_IDS[2], email: "sara.almutairi@example.com", customerName: "Sara Al-Mutairi",
    address: "Olaya Street 21, Riyadh 12244, Saudi Arabia", phone: "+966 55 214 7788",
    status: "processing" as const, paid: true, carrier: null, trackingCode: null,
    lines: [3, 1], daysAgo: 2, shippingMinor: 1500,
  },
  {
    id: DEMO_IDS[3], email: "yuki.tanaka@example.com", customerName: "Yuki Tanaka",
    address: "3-14-1 Jingumae, Shibuya, Tokyo 150-0001, Japan", phone: "+81 90 1234 5678",
    status: "paid" as const, paid: true, carrier: null, trackingCode: null,
    lines: [2, 0], daysAgo: 1, shippingMinor: 0,
  },
  {
    id: DEMO_IDS[4], email: "omar.haddad@example.com", customerName: "Omar Haddad",
    address: "Marina Walk, Dubai Marina, Dubai, UAE", phone: "+971 50 448 9021",
    status: "pending" as const, paid: false, carrier: null, trackingCode: null,
    lines: [1], daysAgo: 0, shippingMinor: 1500,
  },
  {
    id: DEMO_IDS[5], email: "claire.dubois@example.com", customerName: "Claire Dubois",
    address: "7 Quai de la Tournelle, 75005 Paris, France", phone: "+33 7 88 21 40 55",
    status: "refunded" as const, paid: false, carrier: null, trackingCode: null,
    lines: [3], daysAgo: 14, shippingMinor: 0,
  },
];

async function main() {
  await db.delete(orderItems).where(inArray(orderItems.orderId, DEMO_IDS));
  await db.delete(orders).where(inArray(orders.id, DEMO_IDS));

  for (const d of DEMOS) {
    const items = d.lines.map((i) => ({
      handle: LINES[i].handle,
      title: LINES[i].title,
      qty: LINES[i].qty,
      priceMinor: LINES[i].priceMinor,
    }));
    const subtotal = items.reduce((n, i) => n + i.priceMinor * i.qty, 0);
    const createdAt = new Date(Date.now() - d.daysAgo * 86_400_000);

    await db.insert(orders).values({
      id: d.id,
      email: d.email,
      customerName: d.customerName,
      address: d.address,
      phone: d.phone,
      status: d.status,
      subtotalMinor: subtotal,
      shippingMinor: d.shippingMinor,
      totalMinor: subtotal + d.shippingMinor,
      paid: d.paid,
      carrier: d.carrier,
      trackingCode: d.trackingCode,
      createdAt,
    });
    await db.insert(orderItems).values(
      items.map((i, n) => ({ ...i, id: `${d.id}-${n}`, orderId: d.id })),
    );
  }

  console.log(`seeded ${DEMOS.length} demo orders`);
  process.exit(0);
}

main();
