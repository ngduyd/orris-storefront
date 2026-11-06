# ORRIS Storefront v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Storefront đọc được 3,051 sản phẩm từ Postgres: landing, `/shop` có lọc/sort/search, `/product/[handle]`, giỏ hàng, đặt hàng `pending`.

**Architecture:** Next 16 App Router. Đọc dữ liệu qua Server Components gọi thẳng lớp query Drizzle (`src/lib/products.ts`); ghi qua Server Actions. Giỏ hàng = cookie `cart_id` httpOnly + 2 bảng `carts/cart_items`, không có state client toàn cục. Filter nằm trong URL `searchParams`.

**Tech Stack:** Next 16.4.5, React 19.3, Tailwind 4, Drizzle ORM + `pg`, Postgres 16 (Docker :5434), zod, vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-orris-storefront-design.md`

## Global Constraints

- Không Stripe, không auth ở v1. Đơn tạo ra ở trạng thái `pending`.
- Không Redux, không react-query, không axios, không prisma, không framer-motion.
- Tiền: `price_minor` integer (SAR × 100). Không float trong DB.
- `products.handle` là PK; URL dùng handle.
- Rating null ở 2,669/3,051 SKU → component phải render được khi `rating === null`, không hiện 0 sao.
- Copy tiếng Anh. Brand ORRIS, light-only, accent duy nhất `brass`.
- Chỉ dùng token đã có: `ivory`, `ivory-deep`, `ink`, `ink-soft`, `taupe`, `brass`, `line`, `font-serif`, `font-sans`, `label`.

## File Structure

```
src/lib/products.ts     query đọc catalog: list, detail, facets, brand counts
src/lib/filters.ts      parse + validate searchParams (zod), build href
src/lib/cart.ts         đọc/ghi giỏ từ cookie cart_id
src/lib/money.ts        format SAR từ price_minor
src/actions/cart.ts     add/update/remove (server actions), revalidate
src/actions/order.ts    placeOrder
src/components/shop/    product-card, product-grid, filter-bar, note-pyramid, pagination
src/components/layout/  site-header, site-footer, cart-button
src/app/(shop)/         layout, page (landing), shop, product/[handle], cart, checkout
tests/                  products.test.ts, filters.test.ts, cart.test.ts
```

## Tasks

### Task 1 — Query layer + test harness
- [ ] `npm i -D vitest`, thêm `"test": "vitest run"`; `vitest.setup.ts` đọc `.env.local` thủ công (không thêm dotenv).
- [ ] Viết `tests/products.test.ts`: `getProduct('givenchy-givenchy-l-interdit-50ml')` trả brand Givenchy, `notes.base` là array; `listProducts({gender:'Women',limit:5})` trả ≤5 và toàn Women.
- [ ] Chạy test → fail (module chưa có).
- [ ] Viết `src/lib/products.ts` với `getProduct`, `listProducts`, `getFacets`, `getBrands`.
- [ ] Chạy test → pass. Commit.

### Task 2 — Parse filter từ URL
- [ ] `tests/filters.test.ts`: `?gender=Women&size=100&sort=rating` → object đúng; `?size=abc` → bỏ size, không throw; `page=0` → 1.
- [ ] Viết `src/lib/filters.ts` (zod coerce + whitelist sort) + `href` builder giữ filter khi đổi trang.
- [ ] Test pass. Commit.

### Task 3 — Layout + `/shop`
- [ ] `(shop)/layout.tsx`: header (wordmark, nav Women/Men/Unisex/Houses, bag count), footer.
- [ ] `product-card.tsx`: ảnh 4:5, brand label, title serif, giá, rating chỉ khi có.
- [ ] `shop/page.tsx`: grid 24/trang + `filter-bar` (gender, family, size, sort) + `pagination`, mọi thứ lái bằng `href`.
- [ ] `next build` pass; `/shop` SSR trả 24 card. Commit.

### Task 4 — Trang sản phẩm
- [ ] `product/[handle]/page.tsx` + `generateStaticParams` (3,051) + `generateMetadata`.
- [ ] `note-pyramid.tsx` (Top/Middle/Base), accords chips, bảng thông số (size, family, concentration, year, rating).
- [ ] 404 cho handle không tồn tại (`notFound()`); test trong `products.test.ts`.
- [ ] `next build` pass với SSG. Commit.

### Task 5 — Giỏ hàng
- [ ] `tests/cart.test.ts`: thêm 2 lần cùng handle → qty cộng dồn; qty 0 → xoá dòng; cart id mới khi cookie không hợp lệ.
- [ ] `src/lib/cart.ts` + `src/actions/cart.ts` (`addToCart`, `setQty`, `removeItem`), cookie httpOnly 30 ngày.
- [ ] `/cart` page + `cart-button` hiển thị tổng số món (Server Component, không client store).
- [ ] Test pass + `next build`. Commit.

### Task 6 — Đặt hàng pending
- [ ] `src/actions/order.ts`: zod validate email/name/address, đọc cart, tạo `orders` + `order_items` trong 1 transaction, trừ `stock`, xoá cart, trả `orderId`.
- [ ] `tests/order.test.ts`: đặt 2 món → total = Σ price×qty; stock giảm đúng; cart rỗng sau đó.
- [ ] `/checkout` form (Server Action + `useActionState`) → redirect `/checkout/[id]`; trang success đọc order, không lộ email người khác (id là UUID).
- [ ] Test pass + build. Commit.

### Task 7 — Landing 8 khối
- [ ] Hero (1 sản phẩm thật, lấy theo handle cố định trong code), Shop by accord (đếm từ `getFacets`), Bestsellers (`ratingCount DESC`), Editorial split, 3 collection card, New arrivals (`year DESC`), brand marquee, newsletter.
- [ ] Mọi khối lấy dữ liệu thật; không hardcode số sản phẩm.
- [ ] Build pass. Commit.

### Task 8 — Ảnh (sau, độc lập)
- [ ] Python: rembg tách nền → trim → canvas vuông 1200 → gradient cố định + bóng → webp 1200/800.
- [ ] Script upload Cloudinary `public_id = handle`, `folder=perfumes`.
- [ ] Đổi `image` helper sang URL Cloudinary; giữ ảnh gốc trong `data/images/_src/`.

## Review Focus

- `listProducts` phải dùng index (`products_gender_idx`, `products_family_idx`, trgm cho search) — kiểm bằng `EXPLAIN` trên query thật, không đoán.
- Tổng tiền đơn tính từ `price_minor` trong DB tại thời điểm đặt, không tin giá từ client.
- Cookie cart phải httpOnly + `sameSite=lax`; không nhận `cart_id` từ query string.
- `generateStaticParams` 3,051 dòng không được kéo theo query nặng khác trong cùng page.
- Rating null: kiểm 1 SKU không có rating render không vỡ layout.
