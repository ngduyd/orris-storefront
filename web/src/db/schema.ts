import { sql } from "drizzle-orm";
import {
  boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("product_status", ["draft", "active", "archived"]);

/** One row = one SKU (brand + name + size). The natural PK is the handle because URLs use it. */
export const products = pgTable(
  "products",
  {
    handle: text("handle").primaryKey(),
    title: text("title").notNull(),
    brand: text("brand").notNull(),
    gender: text("gender").notNull(),
    concentration: text("concentration"),
    family: text("family"),
    accords: text("accords").array().notNull().default(sql`'{}'::text[]`),
    notes: jsonb("notes").$type<{ top: string[]; mid: string[]; base: string[] }>().notNull(),
    sizeMl: integer("size_ml").notNull(),
    priceMinor: integer("price_minor").notNull(), // SAR * 100 — actual selling price
    compareAtMinor: integer("compare_at_minor"), // regular price before the sale; null = no sale
    rating: numeric("rating", { precision: 2, scale: 1 }),
    ratingCount: integer("rating_count"),
    year: integer("year"),
    description: text("description"),
    image: text("image").notNull(), // primary image (mirrors images[0] when present)
    images: text("images").array().notNull().default(sql`'{}'::text[]`), // gallery, first = primary
    status: statusEnum("status").notNull().default("active"),
    stock: integer("stock").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_brand_idx").on(t.brand),
    index("products_gender_idx").on(t.gender),
    index("products_family_idx").on(t.family),
    index("products_size_idx").on(t.sizeMl),
    index("products_rating_idx").on(t.ratingCount),
    index("products_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    name: text("name"),
    role: text("role").notNull().default("customer"), // customer | manager | carrier
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    provider: text("provider"), // null = email+password; "google" = OAuth
    providerId: text("provider_id"), // provider subject id
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_provider_idx").on(t.provider, t.providerId)],
);

/** Single-use tokens for password reset and email verification. The PK is the token's SHA-256, the raw token is never stored. */
export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(), // reset | verify
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("tokens_user_idx").on(t.userId)],
);

/** Who did what, when — append only. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(), // product.update | order.status | order.shipping | user.role | auth.login | auth.login_failed
    targetType: text("target_type"),
    targetId: text("target_id"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_actor_idx").on(t.actorEmail)],
);

/** Customer reviews. One per account per product; the source-catalog rating stays as a fallback. */
export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    handle: text("handle").notNull(),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(), // 1..5
    authorName: text("author_name"),
    orderId: text("order_id").notNull(), // the paid order this review is anchored to
    hidden: boolean("hidden").notNull().default(false), // hidden by a manager
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_handle_user_idx").on(t.handle, t.userId), index("reviews_handle_idx").on(t.handle)],
);

export const wishlist = pgTable(
  "wishlist",
  {
    userId: text("user_id").notNull(),
    handle: text("handle").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wishlist_pk").on(t.userId, t.handle)],
);

export const carts = pgTable(
  "carts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: text("cart_id").notNull(),
    handle: text("handle").notNull(),
    qty: integer("qty").notNull().default(1),
  },
  (t) => [uniqueIndex("cart_items_pk").on(t.cartId, t.handle)],
);

export const orderStatus = pgEnum("order_status", [
  "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
]);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    email: text("email").notNull(),
    customerName: text("customer_name").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    status: orderStatus("status").notNull().default("pending"),
    subtotalMinor: integer("subtotal_minor").notNull().default(0), // items only
    shippingMinor: integer("shipping_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    couponCode: text("coupon_code"),
    totalMinor: integer("total_minor").notNull(), // what the card is charged
    currency: text("currency").notNull().default("SAR"),
    carrier: text("carrier"), // shipping company
    shippingNotifiedStatus: text("shipping_notified_status"), // last status we emailed the customer about
    shippingNotifiedAt: timestamp("shipping_notified_at", { withTimezone: true }),
    trackingCode: text("tracking_code"),
    stripeId: text("stripe_id"), // checkout session id (unique when set)
    stripePaymentIntent: text("stripe_payment_intent"), // needed for refunds
    stockReleased: boolean("stock_released").notNull().default(false), // stock already returned
    reservedUntil: timestamp("reserved_until", { withTimezone: true }), // stock held until this moment
    paid: boolean("paid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_email_idx").on(t.email),
    index("orders_status_idx").on(t.status),
    uniqueIndex("orders_stripe_id_uniq").on(t.stripeId), // one checkout session per order
    index("orders_reservation_idx").on(t.status, t.reservedUntil),
  ],
);

export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(), // stored upper-case
  percent: integer("percent").notNull(), // 1..90 off the subtotal
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    handle: text("handle").notNull(),
    title: text("title").notNull(),
    qty: integer("qty").notNull(),
    priceMinor: integer("price_minor").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);
