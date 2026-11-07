# ORRIS storefront (app)

Next.js 16 · React 19 · Tailwind 4 · Drizzle + Postgres · Stripe test mode · SMTP · Google OAuth.

## Local dev

```bash
cd web
npm ci
cp ../.env.example ../.env.local      # then fill in real values
npm run db:push                       # create tables (needs pg_trgm)
npm run db:seed                       # load the catalog from ../data/processed/products.csv (not in the repo)
npm run db:admin                      # create the manager account from ADMIN_EMAIL/ADMIN_PASSWORD
npx next dev -p 3000
```

The catalog CSV and images are **not** in the repo (see `.gitignore`: `data/`). To get real data, run the pipeline in `../scripts/` first, or use `scripts/seed-test.ts` (a 2,986-SKU synthetic fixture used by CI).

## Production with Docker

```bash
cp .env.example .env          # DATABASE_URL can be skipped: compose derives it from POSTGRES_*
docker compose -f docker-compose.prod.yml up -d --build
```

Compose runs three services: `db` (postgres 16 + `init-extensions.sql`), `migrate` (one shot, `drizzle-kit push`, must finish before the app starts) and `app` (the `runner` image, port 3000).

On a fresh volume `migrate` creates the schema but there is **no catalog**:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed   # needs ./data mounted
```

`db:seed` reads `../data/processed/products.csv`, and `data/` is not inside the image — mount `./data:/app/data:ro` or load it from another machine.

### Images

Admin uploads (`/admin/products/[handle]`) sign straight to Cloudinary when `CLOUDINARY_URL` is set; without it files are written to `public/uploads` (dev only, gitignored) and served by `/uploads/[...path]`.

The image does **not** contain `public/images` (a symlink into `data/images_norm`, which is ignored). Production requires `CLOUDINARY_CLOUD` — `imageUrl()` returns Cloudinary URLs. To serve local files instead, uncomment the volume in `docker-compose.prod.yml`:

```yaml
#   - ./data/images_norm:/app/public/images:ro
```

## CI/CD

- `.github/workflows/ci.yml` — pull requests and pushes: Postgres 16 service, `pg_trgm`, `seed-test` fixture, `typecheck`, `test`, `build`.
- `.github/workflows/release.yml` — on push to `master`: build and push `ghcr.io/<owner>/orris-storefront:sha` plus `:latest`; the `deploy` job runs only when `DEPLOY_SSH_HOST` exists (with `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`) and pulls the new image on the server.

## Environment

See `.env.example`. Required: `DATABASE_URL`, `CLOUDINARY_CLOUD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Optional: `SMTP_*` + `MAIL_FROM` (links are printed to the server console when unset), `GOOGLE_CLIENT_ID/SECRET` (redirect URI `<origin>/api/auth/google/callback`), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (the pay button is hidden without them).
