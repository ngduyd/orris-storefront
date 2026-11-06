# ORRIS — thiết kế storefront (v1)

2026-11-05

## Ý định và lý do

Một cửa hàng nước hoa tự dựng, dùng làm đồ án portfolio và mẫu chào khách freelance.
Mục tiêu không phải "bán được hàng thật ngay" mà là **chứng minh làm được một storefront
thương mại điện tử chỉn chu**: catalog lớn, trang sản phẩm sâu, giỏ hàng, đơn hàng, admin.

Điểm khác biệt so với một CRUD toy: dữ liệu thật (3,051 SKU, 324 brand, ảnh thật) đã được
làm sạch bằng pipeline riêng, và phần khó — chuẩn hoá dữ liệu bẩn — đã xong trước khi viết UI.

## Người dùng

- Khách: người tìm nước hoa theo hương/giới tính/hãng, cần so sánh nhanh, tin vào ảnh và nốt hương.
- Chủ shop: một người. Cần sửa giá/tồn, xem đơn. Không cần hệ thống phân quyền nhiều cấp.
- Người xem CV: recruiter/khách freelance, mở 3–5 phút. Ấn tượng đầu nằm ở trang chủ và trang sản phẩm.

## Mục tiêu

1. Catalog 3,051 sản phẩm duyệt được: lọc theo gender, family, accords, dung tích, brand; sort; search.
2. Trang sản phẩm đủ sâu để trông "đã": ảnh, kim tự tháp nốt hương, accords, mô tả, thông số.
3. Giỏ hàng hoạt động, giữ được khi reload và qua nhiều thiết bị (server-side, cookie).
4. Đặt hàng tạo ra bản ghi `orders`, hiển thị trong `/account`.
5. Admin 4 trang, sửa giá/tồn/status, đổi trạng thái đơn.
6. Build production chạy được trên host riêng (Node + Postgres), không phụ thuộc Vercel.

## Không làm (non-goals)

- Không tích hợp Shopify (không headless, không Storefront API, không app Shopify).
- Không đa ngôn ngữ ở v1 (copy tiếng Anh).
- Không review/comment của khách, không loyalty, không coupon phức tạp.
- Không upload ảnh từ admin (ảnh đến từ pipeline).
- Không tạo sản phẩm mới trong admin.

## Chống-mục tiêu (làm xong vẫn tính là thất bại nếu)

- Trang chủ trông như template e-commerce generic (carousel, badge "SALE", 4 cột card bo góc).
- Ảnh sản phẩm mỗi cái một nền, lệch tông với UI.
- Có 2 nguồn sự thật cho sản phẩm (admin sửa tay vs CSV) làm dữ liệu lệch.
- Người xem không phân biệt được đâu là dữ liệu thật, đâu là số bịa.

## Ràng buộc

- Dữ liệu: `data/processed/shopify_products.csv` (3,051 dòng, 17 cột), ảnh local 337 MB.
- Rating chỉ có ở 382/3,051 SKU (12.5%) → UI phải chịu được trạng thái không có rating.
- Giá gốc là SAR. Chưa có quyết định về tiền tệ hiển thị.
- Self-host: Postgres trong Docker (`127.0.0.1:5434`), Next standalone + reverse proxy.
- Ảnh: chưa xử lý lại. Kế hoạch rembg + canvas vuông + gradient cố định, chưa thực hiện.
- Không có model ảnh AI trong 9router hiện tại.

## Phương án đã cân nhắc

### 1. Headless Shopify (Next + Storefront API) — loại

Admin miễn phí, checkout chuẩn, ít code nhất. Nhưng phần lớn việc làm nằm ở phía Shopify,
portfolio không chứng minh được năng lực backend/DB của người làm, và dev store không dùng
bán thật. **Bị loại theo lựa chọn của chủ dự án (muốn tự chủ toàn bộ stack).**

### 2. Tự dựng fullstack: Next.js + Postgres + admin riêng — **chọn**

Toàn bộ luồng do mình viết: schema, query, cart, order, admin, auth. Nhiều việc hơn nhưng
mỗi phần đều là thứ để nói trong phỏng vấn. Trade-off: không có admin/checkout miễn phí,
phải tự lo bảo mật và tính đúng đắn của đơn hàng.

### 3. Next.js + Mongo (+ Postgres) — loại

Cân nhắc vì muốn thể hiện document DB. Loại: dữ liệu đã phẳng và đã chuẩn hoá, `jsonb`
trong Postgres phủ đúng nhu cầu; hai DB = hai migration, hai backup, không thêm năng lực.

## Quyết định đã chốt

| Chủ đề | Chốt | Lý do |
|---|---|---|
| Framework | Next.js 16.4 App Router, TS, Tailwind 4 | SSG cho 3,051 trang, một codebase |
| Backend | Route Handlers + Server Actions + zod, không service riêng | Service thứ hai không có lý do kỹ thuật |
| DB | Postgres 16 + Drizzle; PK `products.handle` | Natural key, bỏ 1 cột id và 1 join |
| Search/filter | Postgres `pg_trgm` + `searchParams` | Không cần Algolia; URL share được |
| Cart | cookie `cart_id` httpOnly + bảng `carts/cart_items` | Server là nguồn thật, reload không mất |
| State client | không Redux, không react-query; `zustand` chỉ khi bắt buộc | Redux cho 1 cart drawer là 3 file thừa |
| Auth | better-auth, `role` = customer \| admin, chặn `/admin` | |
| Ảnh | Cloudinary, `public_id = handle`, URL tất định | DB không cần cột ảnh |
| Brand | ORRIS, luxury tối giản, light-only, brass accent duy nhất | |
| Ngôn ngữ | tiếng Anh ở v1 | |

## Còn để ngỏ

Đã chốt 2026-11-05:
- Thứ tự: **storefront trước, admin sau**.
- Phạm vi v1: **không Stripe**. Đặt hàng tạo `orders` trạng thái `pending`, xác nhận bằng trang success. Khách không cần đăng nhập; nhập email khi đặt.
- Tiền tệ hiển thị: SAR.

## Phần giao cho người build

- Cấu trúc route, thành phần UI, cách chia component.
- Chi tiết schema còn thiếu (index, ràng buộc).
- Cách ly dữ liệu giữa storefront và admin (query riêng, không dùng chung type nếu khác nhau).
- Xử lý ảnh: thứ tự bước trong pipeline, tham số canvas/gradient.
- Nội dung copy của landing (ngoài các khối đã nêu).
