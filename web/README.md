# ORRIS storefront (app)

Next.js 16 · React 19 · Tailwind 4 · Drizzle + Postgres · Stripe test mode · SMTP · Google OAuth.

## Local dev

```bash
cd web
npm ci
cp ../.env.example ../.env.local      # rồi điền giá trị thật
npm run db:push                       # tạo bảng (cần pg_trgm)
npm run db:seed                       # nạp catalog từ ../data/processed/products.csv (không có trong repo)
npm run db:admin                      # tạo tài khoản quản lí từ ADMIN_EMAIL/ADMIN_PASSWORD
npx next dev -p 3000
```

Catalog CSV và ảnh **không** nằm trong repo (xem `.gitignore`: `data/`). Muốn có dữ liệu thật, chạy pipeline ở `../scripts/` trước, hoặc dùng `scripts/seed-test.ts` (fixture 2.986 SKU tổng hợp cho CI).

## Production bằng Docker

```bash
cp .env.example .env          # điền DATABASE_URL bỏ qua, compose tự dựng từ POSTGRES_*
docker compose -f docker-compose.prod.yml up -d --build
```

Compose chạy 3 service: `db` (postgres 16 + `init-extensions.sql`), `migrate` (một lần, `drizzle-kit push`, phải xong trước khi app lên), `app` (image `runner`, cổng 3000).

Lần đầu với volume trắng thì `migrate` tạo bảng, nhưng **không có catalog**: nạp bằng

```bash
docker compose -f docker-compose.prod.yml exec app node -e "1"   # app phải chạy
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed   # cần mount data/
```

`db:seed` đọc `../data/processed/products.csv`, mà `data/` không có trong image — mount `./data:/app/data:ro` hoặc nạp từ máy khác.

### Ảnh sản phẩm

Image **không** chứa `public/images` (symlink vào `data/images_norm`, bị ignore). Production bắt buộc `CLOUDINARY_CLOUD` (`imageUrl()` trả URL Cloudinary). Muốn phục vụ ảnh local, mở comment volume trong `docker-compose.prod.yml`:

```yaml
#   - ./data/images_norm:/app/public/images:ro
```

## CI/CD

- `.github/workflows/ci.yml` — pull request + push: Postgres 16 service, `pg_trgm`, `seed-test` fixture, `typecheck`, `test`, `build`.
- `.github/workflows/release.yml` — push `master`: build & push `ghcr.io/<owner>/orris-storefront:sha` + `:latest`; job `deploy` chỉ chạy khi có secret `DEPLOY_SSH_HOST` (kèm `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`), thực hiện `git pull`/`docker compose pull && up -d` trên server.

## Env

Xem `.env.example`. Bắt buộc: `DATABASE_URL`, `CLOUDINARY_CLOUD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Tuỳ chọn: `SMTP_*` + `MAIL_FROM` (không có thì link được in ra console), `GOOGLE_CLIENT_ID/SECRET` (redirect URI `<origin>/api/auth/google/callback`), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (thiếu thì nút Pay ẩn).
