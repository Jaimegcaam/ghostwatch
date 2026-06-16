# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Ghostwatch — production Docker image
#
# Build (with layer cache — much faster rebuilds):
#   DOCKER_BUILDKIT=1 docker build -t ghostwatch:latest .
#
# Rebuilds skip npm ci when package-lock.json is unchanged, and reuse the
# Next.js compiler cache when only app source changed.
# -----------------------------------------------------------------------------

# --- 1. Dependencies ---------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# --- 2. Builder --------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./

# Prisma client — own layer so src-only edits don't re-run generate
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# App source (changes most often — keep above npm run build only)
COPY next.config.ts tsconfig.json postcss.config.mjs config.ts ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# --- 2b. Migrate tooling (minimal — not the full app node_modules) -----------
FROM node:20-alpine AS migrate
RUN apk add --no-cache openssl
WORKDIR /migrate

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-save --no-audit --no-fund prisma@7.6.0 dotenv@17.4.1

# --- 3. Runner ---------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

COPY --from=migrate --chown=nextjs:nodejs /migrate/node_modules /opt/migrate/node_modules
COPY --from=migrate --chown=nextjs:nodejs /migrate/prisma         /opt/migrate/prisma
COPY --from=migrate --chown=nextjs:nodejs /migrate/prisma.config.ts /opt/migrate/prisma.config.ts

COPY --from=builder --chown=nextjs:nodejs /app/scripts         ./scripts
RUN chmod +x ./scripts/docker-entrypoint.sh

RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads
VOLUME ["/app/public/uploads"]

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
