# MEMORY

## Now
- Xong batch tính năng: 3 vai trò (customer/manager/carrier), bill email khi đơn paid, timeline trạng thái + carrier/tracking cho khách, admin đổi trạng thái đơn, trang Sales (doanh số 14 ngày + top houses), /admin/users (đổi role), /admin/audit (audit log), wishlist, link Admin ↔ Shop hai chiều.
- Verify trên tailnet: manager login → /admin (nav 6 mục); carrier login → /admin/orders (nav 1 mục), /admin/products + /admin/users → denied; carrier cập nhật SMSA + tracking OK, không thấy form manager; wishlist lưu/xoá OK; timeline 5 bước; bill SMTP nhận đúng nội dung.
- Chưa làm: gửi mail khi đổi trạng thái vận chuyển, wishlist ở product card, phân trang wishlist.
- Stripe test mode **chạy thật**: bấm Pay tạo được Checkout Session (`cs_test_a1gPz34…`) bằng key test mới. `success_url` giờ trỏ `/api/stripe/confirm` — route này hỏi thẳng Stripe và tự đánh dấu paid, nên không còn cảnh "Payment is being confirmed" khi webhook chậm/sai secret.
- SMTP Resend đã cấu hình trong `.env.local` (port 465). Resend từ chối địa chỉ `@example.com` (550 Invalid `to` field) — phải dùng email thật hoặc địa chỉ testing của Resend.
- Checkout **bắt buộc đăng nhập**: `/checkout` redirect `/account/login?next=%2Fcheckout`; email lấy từ tài khoản (không còn ô nhập); đơn luôn có `user_id`; trang đơn 404 nếu không phải chủ đơn (admin xem qua `/admin/orders`).
- Thêm Google OAuth (authorization-code, không thư viện), quên/đặt lại mật khẩu, xác thực email, rate-limit đăng nhập.
- Email: `src/lib/mail.ts` gửi qua **SMTP** (`nodemailer`), cấu hình bằng `SMTP_URL` hoặc `SMTP_HOST/PORT/USER/PASS/SECURE`; chưa cấu hình thì in link ra console server.
- Việc còn lại: bạn điền `SMTP_*` + `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` trong `web/.env.local`; khai redirect URI `<origin>/api/auth/google/callback`.
- Sửa bug "Your bag is empty" khi xem qua tailnet: cookie `secure` đặt theo `NODE_ENV` (production) nên browser từ chối trên `http://100.86.205.2:3000`; localhost lọt nên test cũ không thấy. Giờ `src/lib/cookie-secure.ts` đọc `x-forwarded-proto`.
- Thêm tài khoản khách: `/account`, `/account/login`, `/account/register` (dùng chung bảng users/sessions + scrypt với admin). Đơn guest cùng email tự hiện trong lịch sử; đơn mới gắn `user_id`.
- Xong Stripe **test mode** (sandbox): nút "Pay" trên `/checkout/[id]`, Checkout Session, webhook `/api/stripe/webhook` ký HMAC, đơn chuyển `paid` khi `checkout.session.completed`.
- Đã verify end-to-end (không cần key thật): dựng server với `STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_test_secret`, tạo đơn thật, POST webhook tự ký → 200, đơn thành paid, trang hiện "Payment received."; chữ ký sai → 400.
- Còn thiếu: tạo Stripe Checkout Session thật (cần key test của bạn), và chạy `stripe listen` để webhook tới được.
- Không còn việc dở. Ứng viên tiếp: deploy (Vercel/Fly) hoặc payOS nếu muốn thu tiền VND thật.

## Decisions
- 2026-11-06 · Role dùng chuỗi `customer|manager|carrier`, bỏ giá trị `admin` cũ (đã update row) · 1 nguồn nghĩa, layout admin đọc role để cắt nav.
- 2026-11-06 · Carrier chỉ có 1 trang (Orders) và chỉ form vận chuyển; manager thấy hết · kiểm quyền ở cả page (requireManager) lẫn action, vì server action gọi trực tiếp được.
- 2026-11-06 · Audit log là bảng chỉ-ghi, ghi ở action (login, product.update, order.status, order.shipping, user.role) · không log mọi request, tránh phình DB.
- 2026-11-06 · Bill gửi từ webhook + từ /api/stripe/confirm, chỉ khi markPaid trả true · tránh gửi trùng khi cả hai đường cùng chạy.
- 2026-11-06 · `success_url` → `/api/stripe/confirm` (retrieve session rồi markPaid) · webhook vẫn giữ cho trường hợp user đóng tab, nhưng UX không phụ thuộc webhook nữa.
- 2026-11-06 · SMTP transport có timeout 8s/15s · SMTP sai cấu hình từng làm treo action đăng ký (await sendMail) tới lúc connection timeout.
- 2026-11-06 · OAuth Google tự viết bằng `fetch` (2 route) thay vì better-auth · đã có sẵn bảng sessions/users + logic session; thêm 1 flow 80 dòng, 0 dependency.
- 2026-11-06 · Bắt đăng nhập mới đặt được đơn · quản lý đơn/lịch sử gọn, đơn nào cũng có chủ.
- 2026-11-06 · Mail đi qua SMTP thuần (nodemailer) thay vì API Resend · SMTP dùng được mọi provider (Resend/Postmark/SES/Gmail app password/Mailtrap); cần thêm `serverExternalPackages: ["nodemailer"]` trong next.config.
- 2026-11-06 · Token reset/verify lưu dạng SHA-256, dùng một lần, reset xoá hết session · không lưu token gốc, đổi mật khẩu là đăng xuất mọi nơi.
- 2026-11-06 · Rate-limit đăng nhập bằng Map trong tiến trình (5 lần/15 phút) · 1 instance; đổi Redis khi scale.
- 2026-11-06 · Origin cho OAuth lấy từ header `host` + `x-forwarded-proto` · `req.url` của Next trả host nội bộ (localhost), sẽ sai redirect_uri khi xem qua tailnet.
- 2026-11-06 · Định danh khách bằng tài khoản email+mật khẩu (không phải magic link) · chưa có email gửi đi nên magic link không khả thi; tái dùng nguyên auth của admin.
- 2026-11-06 · Lịch sử đơn truy vấn `user_id = user.id OR email = user.email` · khách đặt trước khi đăng ký vẫn thấy đơn cũ.
- 2026-11-06 · `secure` cookie theo `x-forwarded-proto`, không theo NODE_ENV · `next start` luôn production nhưng có thể phục vụ http qua tailnet.
- 2026-11-06 · Dùng `stripe` SDK chính thức (23.1.0) thay vì tự ký/verify bằng fetch · phần xác thực chữ ký là chỗ an ninh, không tự phát minh.
- 2026-11-06 · Thanh toán chạy USD (SAR/3.75) khớp giá hiển thị, DB vẫn giữ SAR gốc · tránh 2 đơn vị tiền trong 1 đơn.
- 2026-11-06 · Nút Pay ẩn khi thiếu `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` · site chạy như v1 (đơn pending), không crash.
- 2026-11-06 · `markPaid` chỉ đổi đơn đang `pending` · webhook đến chậm/replay không ghi đè cancelled/refunded.
- 2026-11-06 · Không dùng Stripe live · Stripe không hỗ trợ merchant VN (stripe.com/global), chỉ test mode; muốn thu thật phải qua MoR hoặc payOS/VNPAY.
- 2026-11-06 · Badge giỏ hàng đọc cookie `cart_n` (không httpOnly) trong client component · giữ nguyên static rendering; server chỉ set cookie khi mutation.
- 2026-11-06 · Mô tả "The house says" gập bằng `<details>` mặc định đóng · không cần JS, nội dung vẫn nằm trong DOM.
- 2026-11-06 · Không chuẩn hoá lại 3,050 ảnh · số đo cho thấy chiều cao chai đã đồng đều, phần lệch là do dáng chai/giới hạn bề ngang.
- 2026-11-06 · Admin auth tự viết bằng `node:crypto` scrypt + bảng `sessions` sẵn có, **không cài better-auth** · 1 user admin, đổi lại 1 script; better-auth kéo schema + flow email không dùng tới. Nâng cấp khi cần nhiều user/role.
- 2026-11-06 · Guard đặt ở `app/admin/(dash)/layout.tsx` (`requireAdmin` → redirect), không dùng middleware · middleware Next chạy runtime riêng, không truy vấn DB tiện; layout là chỗ duy nhất mọi trang admin đi qua.
- 2026-11-06 · Admin chỉ sửa giá/tồn/status, không tạo/sửa nội dung · CSV vẫn là nguồn sự thật duy nhất.
- 2026-11-05 · Giá hiển thị USD, quy đổi từ SAR tại 3.75 (SAR pegged USD từ 1986) · hằng số thật, không phải tỷ giá đoán; DB vẫn lưu SAR minor.
- 2026-11-05 · `accords` trên trang sản phẩm là link `/shop?accord=<name>`; House/Family/Gender trong bảng thông số cũng là link filter; brand trong product card là link riêng (không lồng thẻ `<a>`).
- 2026-11-05 · Animation thuần CSS: `fade-up`/`fade-in`/`link-underline` + easing `--ease-out-soft`, tôn trọng `prefers-reduced-motion` · không thêm framer-motion.
- 2026-11-05 · Bỏ newsletter ở landing · không có bảng subscribers, form giả thì vô nghĩa; khối 8 thay bằng closing note.
- 2026-11-05 · Ảnh chuẩn hoá tất định (mask theo alpha/màu viền + canvas ivory + bóng) · không dùng model AI cho 3,050 ảnh: lệch style, tốn tiền, không reproducible.
- 2026-11-05 · 1 SKU ảnh hỏng → `status='draft'` thay vì chèn ảnh placeholder · storefront không bao giờ hiện ảnh gãy.
- 2026-11-05 · Review loop chạy inline, không dispatch implementer subagent mỗi task · 8 task dùng chung schema/lib, chia context mới là overhead; reviewer vẫn fresh-context.
- 2026-11-05 · `q` escape `%`/`_` trước khi vào ILIKE · gõ `%` không được khớp cả catalog; brand filter dùng ILIKE để không phân biệt hoa thường.
- 2026-11-05 · Tên store: ORRIS · nguyên liệu thật (rễ diên vĩ), 5 chữ, không dính thương hiệu trong dataset.
- 2026-11-05 · Brand: luxury tối giản, light-only, brass là accent duy nhất · theo yêu cầu; bỏ dark mode để đỡ 2 bộ token.
- 2026-11-05 · Ảnh AI (flux qua 9router/CF) chỉ dùng cho hero/lifestyle 3–5 ảnh · model ảnh không render chữ đúng và lệch style giữa các lần gen; typography làm bằng code.
- 2026-11-05 · Hướng B: tự dựng admin, không dùng Shopify làm backend/headless · yêu cầu của user, giữ toàn bộ stack tự chủ.
- 2026-11-05 · Admin KHÔNG có tạo sản phẩm mới, chỉ sửa giá/stock/status/nội dung · pipeline CSV là nguồn sự thật duy nhất; tạo tay = hai nguồn lệch nhau.
- 2026-11-05 · PK của `products` là `handle` (natural key) · URL dùng handle, bỏ được 1 cột id và 1 join.
- 2026-11-05 · State: cart = cookie `cart_id` + Postgres; filter = URL searchParams; không Redux, không react-query, không axios, không prisma, không framer-motion.
- 2026-11-05 · Stack: Next.js 16.4 App Router + TS + Tailwind + shadcn/ui, SSG/ISR cho 3,051 trang · catalog tĩnh, không cần SSR động.
- 2026-11-05 · Backend = Route Handlers + Server Actions + zod, KHÔNG dựng backend riêng (không NestJS) · service thứ 2 không có lý do kỹ thuật.
- 2026-11-05 · DB: Postgres only + Drizzle; `notes`/`accords` dùng `jsonb` · dữ liệu đã phẳng và sạch, Mongo không thêm gì. (đã chốt, bỏ Mongo)
- 2026-11-05 · Ảnh: Cloudinary, `public_id = handle`, folder `perfumes/` → URL tất định, DB chỉ cần `handle` · free plan 25 credit/tháng, catalog dùng ~3-9 credit.
- 2026-11-05 · Deploy self-host: `output: 'standalone'` + Node 22 + Caddy/nginx, Postgres Docker local, driver `node-postgres` (không neon-http) · có host riêng.
- 2026-11-05 · Bỏ ghép Fragrantica + eBay; dùng GoldenScent (`rawanalqarni/Perfumes_Recommender`) làm nguồn duy nhất · 1 bộ đã có đủ ảnh/giá/size/notes, merge 2 bộ chỉ đạt trần 2000 listing.
- 2026-11-05 · Merge theo khóa `brand + normalized_name`, không join title eBay thô · title eBay là chuỗi listing rác, join chính xác ra 0 dòng. (giữ làm nguyên tắc nếu sau này có ghép)
- 2026-11-05 · Đếm "sản phẩm đủ trường" theo SKU sau dedup, không theo listing eBay · 2k listing ≠ 2k sản phẩm, cùng chai lặp nhiều size.
- 2026-11-05 · Tách `community_rating` (Fragrantica) và `seller_rating` (eBay), không gộp 1 cột `rating` · khác nghĩa hoàn toàn.
- 2026-11-05 · `.pi/mcp.json` chỉ tắt `obsidian`; giữ serena + codegraph + context7 · pipeline sẽ có code Python (normalize, fuzzy match, parse ml) nên cần điều hướng symbol.
- 2026-11-05 · Serena là owner cho đọc/điều hướng code, không hỏi trùng cả serena và codegraph · một capability một tool (AGENTS.md).
- 2026-11-05 · Xử lý dữ liệu gốc trước, ảnh xử lý sau · theo yêu cầu.

## Measured
- 2026-11-06 · doanh số: 5 dòng trong 14 ngày, 15 user, 2 audit row sau khi đổi role
- 2026-11-06 · bill SMTP thật · nội dung: "1 × Explorer — $54.67 / Tổng: $54.67 / Giao đến: Bill User"
- 2026-11-06 · Stripe test mode · session `cs_test_a1ARaESTuK0g0IB` tạo được từ UI, redirect sang checkout.stripe.com
- 2026-11-06 · SMTP `smtp.resend.com:465` · kết nối được, bị chặn ở bước `to` với domain example.com
- 2026-11-06 · luồng auth trên `http://100.86.205.2:3000` · anon /checkout → login; đăng ký → về /checkout; đơn gắn tài khoản; verify email xoá banner; reset mật khẩu → đăng nhập bằng mật khẩu mới OK; 6 lần sai → chặn "Quá nhiều lần thử"
- 2026-11-06 · 42 test pass · tsc sạch · anon xem đơn người khác → 404
- 2026-11-06 · SMTP thật: sink SMTP cục bộ (127.0.0.1:2525) nhận 1 mail, link verify trong body dùng được (body là quoted-printable nên phải decode khi test)
- 2026-11-06 · tailnet `http://100.86.205.2:3000` · trước fix: cookie chỉ có `cart_n` (cart_id bị bỏ); sau fix: `cart_id` + `cart_n`, /checkout trả 200
- 2026-11-06 · luồng tài khoản · guest order → đăng ký cùng email → lịch sử 1 đơn; đơn thứ 2 → 2 đơn; email prefill đúng; signout chặn /account
- 2026-11-06 · test suite · 42 pass (39 + 3 webhook signature)
- 2026-11-06 · webhook `/api/stripe/webhook` · chữ ký sai 400, chữ ký đúng 200, đơn `pending` → `paid`
- 2026-11-06 · tỉ lệ chiều cao chai trong ảnh chuẩn hoá (bỏ bóng) · p10=0.70 p50=0.78 p90=0.79 (mục tiêu 0.78); chỉ 23/3,050 nhỏ hơn 0.5 và đều là chai trắng/bị giới hạn 86% bề ngang
- 2026-11-06 · badge giỏ: trước khi thêm 0 → sau khi thêm 1, cookie `cart_n=1` đúng
- 2026-11-06 · `<details>` mô tả: mặc định open=false, click → open=true, 887 ký tự
- 2026-11-06 · `codegraph init web/` · 40 files, 343 nodes, 739 edges, DB 0.96 MB; `.codegraph/` + `.serena/` đã vào .gitignore
- 2026-11-06 · image = `handle + '.webp'` · 2,986/2,987 (1 ngoại lệ là draft hỏng nguồn)
- 2026-11-06 · test suite · 39 pass (36 cũ + 3 auth)
- 2026-11-05 · catalog sau khi lọc thêm nến/bakhoor · 2,987 SKU seeded, 2,986 active, 1 draft
- 2026-11-05 · accord "Charismatic" · 533 sản phẩm · giá USD 109.07 = SAR 409
- 2026-11-05 · chuẩn hoá ảnh · 3,050/3,051 · 337.5 MB → 109 MB · TB 34 KB/ảnh · 10m39s
- 2026-11-05 · `next build` · ~50-115s · `/` static (revalidate 1h), `/shop` `/cart` `/checkout` `/product/[handle]` dynamic
- 2026-11-05 · runtime curl · `/` 200 "3,050 bottles", `/product/...` 200 (Notes/Accords/Not yet rated/SAR 362), `/images/*.webp` 200 image/webp 42 KB, `/checkout` 307 → `/cart`
- 2026-11-05 · test ổn định · 33 pass × 3 lần liên tiếp · stock không drift (`fileParallelism: false` vì dùng chung Postgres)
- 2026-11-05 · vitest · 20 test, 2 file, ~1.1s · `npm test`
- 2026-11-05 · `next build` · TS check + 4 static page OK
- 2026-11-05 · top 100 sort `rating_count desc nulls last` · 0 NULL; bỏ `nulls last` · 100 NULL (tiêu chí test)
- 2026-11-05 · goldenscent.csv · 6,237 dòng · 19 cột · 5,681 SKU unique (brand+name)
- 2026-11-05 · SAI: báo "4,284 dòng đủ trường" · `Rate`/`image` dùng chuỗi `none`, không phải null → đếm nhầm. Số đúng ở dưới.
- 2026-11-05 · rating thật sự · 586/6237 = 9.4% · image 4,880 = 78.2%
- 2026-11-05 · đủ 13 trường core · 3,093 dòng · đủ 13 + rating · 407
- 2026-11-05 · Size parse được · 85.5% (100ml 2404, 50ml 940, no-parse 901)
- 2026-11-05 · Concentration phủ · 76.4% · EDP 3409 / EDT 971
- 2026-11-05 · Gender bẩn · 317 rỗng + lẫn brand/category (Room Spray/Bakhoor/Candle) → phải whitelist
- 2026-11-05 · Price lưu dạng "199 SAR" string · Rating_count dạng "9 Rating" · phải regex
- 2026-11-05 · `products.csv` cuối · 3,051 SKU · 324 brand · 0 handle trùng · price 10–6285 SAR · rating 382 SKU
- 2026-11-05 · ảnh tải về · 3,051/3,051 thành công · 0 lỗi · 337.5 MB · jpg 1929 / png 1122

## Dead ends
- Chờ `**/admin/**` trong Playwright sau khi login · khớp luôn /admin/login nên báo sai; phải chờ đúng `/admin/orders`.
- `cd X && cmd &` trong bash · background cả chuỗi nên shell không đổi thư mục -> script ghi sai chỗ; tách `cd` khỏi lệnh nền.
- `SMTP_PORT=456` (thiếu số 6) · nodemailer treo tới connection timeout; triệu chứng là form đăng ký không chuyển trang.
- `nodemailer.createTransport(url, options)` · tham số 2 là SendMailOptions, không phải transport options ⇒ phải parse URL thành object.
- Tin vào test trên localhost cho hành vi cookie · localhost là secure context nên cookie `secure` vẫn được nhận, che mất bug thật.
- Gọi webhook ngay sau khi thêm route mà chưa `next build` → 404 (route mới không có trong build đang chạy).
- `tsx scripts/x.ts` có top-level await → `Transform failed with 4 errors`; package.json không `"type":"module"` nên tsx coi là CJS · bọc trong `async function main()`.
- Module dùng `next/headers` (auth.ts) import từ script tsx cũng lỗi transform · tách `src/lib/password.ts` không phụ thuộc Next.
- 2026-11-05 · SSG `generateStaticParams` cho 3,051 trang · build treo >15 phút (1 query/trang) → đổi sang ISR `revalidate=3600` + `dynamicParams`.
- 2026-11-05 · `cacheComponents: true` (template Next 16) + trang đọc searchParams · lỗi "uncached data during prerendering"; `connection()` không cứu → tắt `cacheComponents` trong `next.config.ts`.
- 2026-11-05 · Test order chạy song song với cart · deadlock khoá row `products` → timeout 5s; fix `fileParallelism: false`, `testTimeout: 20000`.
- 2026-11-05 · Khôi phục stock bằng map ghi trong từng test · ghi đè sai thứ tự, stock trôi mỗi lần chạy → dùng baseline chụp 1 lần ở module scope.
- 2026-11-05 · Seed upsert không set `status`/`image`/`stock` · đổi giá trị trong CSV không vào DB cũ; phải thêm vào `set`.
- 2026-11-05 · `curl` tải ảnh CDN không có User-Agent · PNG hỏng (chunk 0) → phải gửi UA; 1 file vẫn hỏng hẳn.
- 2026-11-05 · Fanout `subagent({workflow:"parallel"})` cho reviewer · fail 2 lần (args/workflow-script), rồi child `reviewer` báo model mặc định không có trong registry → phải truyền `model: 9router/KG/claude-sonnet-4.5` và chạy single call mỗi turn.
- 2026-11-05 · `9router/gh/gpt-5.3-codex` cho child · "model_not_supported", provider đăng ký bởi parent extension → dùng KG/claude-sonnet-4.5.
- 2026-11-05 · Reviewer P1 "ORDER.rating thiếu NULLS LAST" · false positive, code đã có `nulls last`; kiểm bằng PgDialect + SQL live trước khi sửa.
- 2026-11-05 · Brand-kit board bằng AI · 9router có 202 model, 0 model image → không sinh được. Dùng CF flux sau khi reload, chỉ cho hero.
- 2026-11-05 · `tsx` chạy script đọc `.env.local` · tsx không tự load file env như Next → `password must be a string`. Fix: `tsx --env-file=.env.local`.
- 2026-11-05 · `db.execute()` của drizzle trả object, không phải array · destructuring gây "not iterable". Dùng `db.select({n: sql`count(*)::int`})`.
- 2026-11-05 · `psql` local của máy · role `ngduyd` không tồn tại, không có superuser → dùng Postgres trong Docker thay vì đụng server hệ thống.
- 2026-11-05 · Tắt serena/codegraph vì "chưa có code" · sai, code Python sẽ có ngay bước làm sạch dữ liệu. Đã bật lại.
- 2026-11-05 · Ghép Fragrantica 24k + eBay 2000 để lấy đủ trường · trần 2000 listing, thực tế vài trăm SKU, lại phải fuzzy match title rác → bỏ, dùng GoldenScent.
- 2026-11-05 · Đặt suffix handle trùng theo index toàn cục · handle đổi mỗi lần rebuild làm lệch tên file ảnh. Sửa thành counter theo base.
- 2026-11-05 · Cover 24k Fragrantica · thiếu ảnh + giá + size, phải ghép 3 nguồn. GoldenScent 3,051 SKU đủ hết, rẻ hơn.

## Next
1. `CLOUDINARY_URL` → `python3 scripts/upload_cloudinary.py` (3,050 ảnh, `public_id = handle`), rồi đổi helper ảnh sang URL Cloudinary.
2. Auth (better-auth) + `role` + middleware chặn `/admin`; sau đó 4 trang admin.
3. `tsc --noEmit` vào CI (lỗi type chỉ build mới bắt).
4. Sitemap + robots; warm-up sau deploy nếu cold ISR thành vấn đề.
5. Newsletter: đã bỏ khối này (không có nơi lưu email) — thêm khi có bảng `subscribers`.
1. Task 3: `(shop)/layout.tsx` (header/footer/bag), `product-card`, `/shop` với filter bar + pagination.
2. Task 4: `/product/[handle]` + `generateStaticParams` (`getHandles` đã có) + NotePyramid.
3. Task 5-6: cart (cookie) + đặt hàng `pending`.
4. Task 7: landing 8 khối.
5. Task 8: pipeline ảnh rembg + Cloudinary.
6. Thêm `tsc --noEmit` vào `npm test`/CI · lỗi type `getFacets` chỉ build mới bắt, test không bắt.
