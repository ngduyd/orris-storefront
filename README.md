# ORRIS

A fragrance storefront built end to end: catalogue pipeline, Next.js shop, self-hosted admin
console, Stripe payments, transactional email, and a container image built by CI.

Everything in the UI, code and docs is English. The data is a real Saudi/Gulf fragrance
catalogue, priced in SAR and displayed in USD.

## What it does

**Shop**

- Landing page, `/shop` with gender / brand / accord / family / size filters, search, sort, pagination
- Product page: gallery, note pyramid, specs, sale badge, real review average, JSON-LD
- Wishlist, cart, one-page checkout, order page with a Stripe test-mode payment button
- Printable invoice, terms, privacy, sitemap, robots, branded 404

**Accounts**

- Email + password (scrypt, own `sessions` table — no auth library), Google OAuth
- Email verification, password reset, password change, rate limits on every credential path
- Order history; an order is visible only to its owner, a manager, or a *verified* matching email

**Admin** (`/admin`, three roles: `customer`, `manager`, `carrier`)

- Overview, sales (14 days + top houses), orders (search, status filters, CSV export), products
  (price, sale price, stock, status, description, multi-image upload), customers, brands,
  reviews, audit log
- Carrier role is limited to `/admin/orders` and the shipping form, and a shipment can only move
  forward: `paid → processing → shipped → delivered`

**Orders and money**

- Stock is held for 35 minutes at checkout and released exactly once on cancel, expiry or refund
- Stripe Checkout (test mode); the `success_url` confirms the payment itself, the webhook is the
  safety net for closed tabs; `checkout.session.expired` frees the hold immediately
- A payment that lands after the hold was released is refunded automatically, never kept silently
- Coupons (percent off) and a flat shipping fee waived above a threshold
- Receipt, shipping notice, cancellation and refund emails

## Stack

Next.js 16 (App Router, standalone output) · React 19 · Tailwind 4 · Postgres 16 with Drizzle
(no ORM wrapper beyond Drizzle, no Prisma) · Stripe · nodemailer · Cloudinary for uploads ·
Vitest · Docker + GitHub Actions.

## Layout

```
.
├── data/               raw + processed catalogue, normalised images  (gitignored, ~110 MB)
├── scripts/            python pipeline: build_products → download → normalize → upload
├── docs/superpowers/   spec and plan the build followed
├── web/                the application (see web/README.md for app-level detail)
├── init-extensions.sql pg_trgm, mounted by compose
├── docker-compose.yml  local database only (127.0.0.1:5434)
├── docker-compose.prod.yml  db + one-shot migrate + app
└── .github/workflows/  ci.yml (typecheck, tests, build), release.yml (image → ghcr.io)
```

## Run it

### Local

```bash
docker compose up -d                    # postgres on 127.0.0.1:5434
cd web && npm ci
cp ../.env.example .env.local           # fill in what you need, see below
npm run db:push && npm run db:seed      # schema, then the catalogue from ../data/processed
npm run db:admin                        # manager account from ADMIN_EMAIL / ADMIN_PASSWORD
npx next dev -p 3000
```

`web/data/products.csv` (3.1 MB) is committed and baked into the migrator image, so `db:seed` works
everywhere with no manual file copy. The images and the raw source stay out of the repo: regenerate
them with the python pipeline in `scripts/`, or use `web/scripts/seed-test.ts` — a synthetic fixture
CI uses. In a container the seeder
only needs the CSV (`-v ./data/processed:/data/processed:ro`); without `data/images_norm` it falls
back to `<handle>.webp`, which is the Cloudinary public id.

### Docker (production shape)

```bash
cp .env.example .env
# either use the image CI published (the package is private: log in once)
docker login ghcr.io -u <user> -p <token>
docker compose -f docker-compose.prod.yml pull
# schema, once per deploy; also creates pg_trgm on a volume that predates init-extensions.sql
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
# this file never builds; to run a local build instead, tag it by hand first
docker build -f web/Dockerfile --target runner  -t ghcr.io/ngduyd/orris-storefront:latest   web
docker build -f web/Dockerfile --target migrator -t ghcr.io/ngduyd/orris-storefront:migrator web
docker compose -f docker-compose.prod.yml up -d
```

`DATABASE_URL` is the single source of truth for the app and the migrations; `POSTGRES_*` only
configure the bundled `db` container, so keep them describing the same database (or point
`DATABASE_URL` at a managed one and leave `db` alone). Compose refuses to start without it, which
is deliberate: podman-compose does not expand nested defaults such as `${A:-${B}}`.

`docker-compose.prod.yml` only pulls: it has no `build:` at all, so a deploy can never ship a
tree that was not built by CI. `release.yml` publishes two tags per commit — `latest` (the
runner) and `migrator` (the same Dockerfile with drizzle-kit for `db:push`).

`web/scripts/e2e-self-refund.mjs` drives a deployed store through the whole money path in Stripe test
mode (register, buy, pay 4242, cancel and refund) and fails loudly if the refund does not settle:
`node scripts/e2e-self-refund.mjs https://your-host`.

`scripts/deploy.sh` does the steps in order and works with docker or podman: `up -d db`, wait for
`pg_isready`, `run --rm --no-deps migrate`, then `up -d db app`. The one-shot `migrate` service is
never part of `up` (it is named explicitly nowhere) because podman-compose hangs when a one-shot
container is a `depends_on` target, and it cannot `run` a service that sits behind a profile. The
deploy job in `release.yml` runs the same script over SSH, so a push to master is all it takes. The catalogue still has to be loaded separately (the image does not ship `data/`).

## Vercel

`web/vercel.json` (root directory `web`) adds a daily cron that sweeps expired stock reservations —
Hobby allows one run per day. It is only a backstop: `placeOrder` sweeps before every checkout and
`/admin/orders` sweeps when a manager opens it. `output: "standalone"` is applied only when
`BUILD_TARGET=docker`, because Vercel rejects it. Uploads must go to Cloudinary: the local
`public/uploads` path is read-only there. Rate limits stay per instance, and the durable claims
(stock, refunds, shipping notices) are still enforced in Postgres.

## Environment

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | everything. Required by compose; use `@db:5432` inside the stack, `@127.0.0.1:5434` (or a managed host) outside. All values live in `.env` (the app container loads that file) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | card payment (test keys work) |
| `CLOUDINARY_URL`, `CLOUDINARY_CLOUD` | admin uploads, product images in production |
| `SMTP_URL` or `SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM` | email; unset means links print to the server log |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in, redirect `<origin>/api/auth/google/callback` |
| `SHIPPING_FLAT_MINOR`, `FREE_SHIPPING_OVER_MINOR` | shipping fee (SAR minor units, 0 = free) |
| `SITE_URL` | absolute URLs in `sitemap.xml` and `robots.txt` |
| `REQUIRE_VERIFIED_EMAIL` | refuse checkout until the address is confirmed (default off) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | only read by `npm run db:admin` |

## Tests and CI

```bash
cd web
npm test          # 78 tests against a real Postgres, no mocks
npm run typecheck # next typegen + tsc
npm run build
```

Coverage: cart arithmetic, filters and search escaping, money/sale maths, order placement
including a concurrent double submit, reservations and expiry, refunds restoring stock once,
forward-only shipping, rate-limit windows, single-use tokens, order access rules, webhook
signature verification, and a guard test asserting every admin action starts with a role check.

Branches: work on `dev` — CI runs there and nothing is deployed from it. PRs are merged with a merge
commit (`gh pr merge --merge`), never squashed: squashing rewrites the commits, so `dev` would keep
looking unmerged and every later PR would re-list old work, and the only way out of that is a
force-push. Before opening a PR, `git fetch && git merge origin/master` so the branch is current. When it is green, merge to
`master`; that push re-runs the same checks, publishes the images and deploys to Vercel, so nothing
reaches production unless the checks pass. A `v*` tag is only a marker for a release and deploys
nothing.

CI runs the same sequence on a Postgres service. A push to `master` (or a `v*` tag) makes
`release.yml` build and push `ghcr.io/ngduyd/orris-storefront:{sha, ref name, latest}` plus the
matching `-migrator` tags. Vercel itself builds and deploys the same push through its Git
integration (`web/vercel.json` enables that for `master` only), so the workflow needs no Vercel token.
Vercel deploys come from its own Git integration rather than from Actions, so no Vercel secrets are
needed; `master` is protected so a merge cannot happen while the checks are red.

## Limits, on purpose

- Single instance. Rate limits live in process memory; the durable parts (stock claims, shipping
  notices) are enforced in Postgres instead, so no Redis is needed. Add one before scaling out.
- Card payments are test mode only: Stripe does not onboard merchants in Vietnam.
- The admin cannot create products — the CSV pipeline is the source of truth, the admin edits
  price, stock, status, description and images.
- English only, no i18n or RTL, no analytics or cookie banner (no third-party trackers).
- `REQUIRE_VERIFIED_EMAIL` is off so the demo stays usable with throwaway addresses.
