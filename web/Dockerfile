# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
ENV BUILD_TARGET=docker
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS migrator
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# pg_trgm first: the schema has a gin_trgm_ops index, and an existing volume never runs
# docker-entrypoint-initdb.d/init-extensions.sql
CMD ["sh", "-c", "node scripts/ensure-extensions.mjs && npm run db:push"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
