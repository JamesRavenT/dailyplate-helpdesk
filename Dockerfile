# syntax=docker/dockerfile:1
# Single-service production image: builds the SPA, then serves it from the Express backend.
# Railway builds this from the repo root.

# ---- Stage 1: build the frontend SPA ----
FROM oven/bun:1 AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install
COPY frontend/ ./
# Frontend Sentry — all build-time. VITE_SENTRY_DSN is inlined into the bundle (runtime
# error reporting). The SENTRY_AUTH_TOKEN/ORG/PROJECT trio enables source-map upload during
# the build so stack traces in Sentry are de-minified (optional — skipped if unset).
# On Railway these are passed automatically from same-named service variables (they're ARGs).
ARG VITE_SENTRY_DSN=""
ARG SENTRY_AUTH_TOKEN=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT
RUN bun run build

# ---- Stage 2: backend runtime (also serves the built SPA) ----
FROM oven/bun:1 AS backend
WORKDIR /app
COPY backend/package.json backend/bun.lock* ./
RUN bun install
COPY backend/ ./
# prisma.config.ts requires DATABASE_URL to resolve at config-load time; generate doesn't
# connect, so a throwaway placeholder satisfies it without persisting into the image.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    bun node_modules/prisma/build/index.js generate
# Express serves this dir from ./public when NODE_ENV=production (see src/index.ts)
COPY --from=frontend /fe/dist ./public

ENV NODE_ENV=production
EXPOSE 3001

# Apply pending migrations, seed the admin (idempotent — skipped if it already exists), then start.
CMD ["sh", "-c", "bun run prisma:deploy && (bun run prisma:seed || echo '[seed] skipped/failed') && bun src/index.ts"]
