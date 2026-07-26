# Architecture & design decisions

This document explains how DailyPlate Helpdesk is put together and — more importantly — *why*.
For deployment steps, see [../how-to/deploy.md](../how-to/deploy.md).

## The big picture

```
                         ┌─────────────────────────────────────────┐
   Browser ──────────────►  Cloudflare Worker  (one origin)         │
                         │    ├─ /*              → built SPA assets  │
                         │    ├─ /api/*, /health → reverse-proxy ────┼──► Render
                         │    └─ /api/internal/* → blocked (404)     │     (Express + pg-boss
                         └─────────────────────────────────────────┘      + Better Auth + AI)
                                                                                │
   Resend inbound ──► n8n gateway (GCP VM) ──► POST /api/internal/* ────────────┘
                                                                                │
                                                                                ▼
                                                                          Neon Postgres
```

## One origin, proxied API

**Decision:** the Cloudflare Worker serves the SPA *and* reverse-proxies `/api/*` to Render,
rather than hosting the frontend and backend on separate subdomains.

**Why:** Better Auth uses first-party, host-only session cookies. If the SPA and API were on
different origins, we'd need cross-site cookie configuration (`SameSite=None`, a shared parent
domain) and CORS. By making the Worker the single origin the browser sees, cookies set by the
backend pass straight through and remain first-party — no CORS, no cross-site cookie caveats.
The Worker uses `redirect: "manual"`, forwards `Set-Cookie` untouched, sets `X-Forwarded-*`,
and only rewrites a `Location` header if it points back at the backend origin.

Internal service endpoints (`/api/internal/*`) are blocked at the edge so they're only reachable
server-to-server.

## Why the backend runs on Render (not Cloudflare Workers)

**Decision:** keep the Express + pg-boss backend on a container host — Render; do not port it to
Workers.

**Why:** the backend is a long-running process. pg-boss runs background workers and a
per-minute scheduled job (agent-presence sweep) that need a persistent runtime — something
Cloudflare Workers (stateless, request-scoped isolates) can't provide without a substantial
rewrite to Queues + Cron Triggers. Render runs the existing `backend/Dockerfile.prod` image
unchanged, so the tested behavior is preserved. Cloudflare handles what it's good at (edge
static assets + routing); Render handles the stateful server.

**Why migrations run at container start:** Render's `preDeployCommand` — the direct equivalent
of the pre-deploy hook this project previously used — is only available on paid instance types.
On the free plan the deploy is therefore fronted by `backend/docker-entrypoint.sh`, which runs
`prisma migrate deploy`, then the idempotent seed (failure logged, non-fatal), then `exec`s the
server. `render.yaml` carries a commented-out `preDeployCommand` to switch back to a true
pre-deploy step on a paid plan. The service runs a single instance, and `prisma migrate deploy`
takes a Postgres advisory lock, so there is no migration race.

## Database: pooled vs. direct connections

**Decision:** Neon serverless Postgres, with runtime traffic on the **pooled** connection and
the Prisma CLI on the **direct** connection.

**Why:** Neon's PgBouncer pooler (transaction mode) doesn't support session-level features.
Schema migrations need a direct connection, so `prisma.config.ts` reads `DATABASE_URL_UNPOOLED`
(falling back to `DATABASE_URL` for local dev). Prisma's runtime adapter and pg-boss both use
the pooled `DATABASE_URL` — pg-boss here polls and uses only transaction-scoped advisory locks,
so it is pooler-safe.

**Trade-off:** the per-minute presence sweep keeps Neon's compute awake, so scale-to-zero
savings don't apply while the backend runs. This is documented as a known limitation. On a
Render free instance the inverse also holds: once the service spins down for inactivity the
sweep stops firing, so agents can stay marked `ONLINE` until the next request wakes the server.

## The inbound email pipeline (n8n + Render)

**Decision:** an n8n workflow is the inbound webhook front door; it verifies the signature and
forwards to a token-authenticated Render endpoint that runs the actual pipeline.

**Why:** this offloads the webhook entry point and adds retry/observability (Resend's ~24h
delivery retries + n8n's execution retries) *without* moving business logic out of tested
TypeScript. The thread-matching, ticket creation, round-robin routing, and AI triage all stay
on Render behind `POST /api/internal/resend-inbound`, which is guarded by a timing-safe
`INTERNAL_API_TOKEN` check and is unreachable from the public edge.

**Honest trade-off:** because the AI SDK is also used for authenticated ticket summaries and
reply polishing, it stays on Render — so n8n's cost benefit is marginal. Its real value is
architectural (event-driven front door, resilience) rather than a lower bill.

## Asynchronous AI processing

New tickets are enqueued to **pg-boss** and processed by a worker off the request path, so
webhook/API responses return immediately and AI work is retry-safe. The AI is constrained by
prompt to answer only policy-only questions and to never claim account-specific actions; if it
can't safely resolve, the ticket is round-robin assigned to an available agent (load-capped at
5 concurrent open tickets each).

## Authentication

Database-session based (no JWTs), via Better Auth. Sessions live in the Postgres `session`
table with a 7-day expiry. **Sign-up is disabled** — the first admin is seeded and further users
are created by admins from the UI. Roles (`ADMIN` / `AGENT`) are a custom field on the user and
enforced by `requireAuth` / `requireAdmin` on every route.

## Frontend design system

The UI is a cohesive operations-console design system rather than ad-hoc styling: a dark
sidebar app shell, a semantic status/priority color language (kept distinct from the brand
accent), Geist for UI text and Geist Mono for data/IDs/metrics, and shared loading/empty/error
states. Primitives are shadcn/ui (base-nova) on `@base-ui/react`; the `Button` renders a native
`<button>` for ordinary actions (so `disabled` is a real HTML state) and defers to Base UI only
for polymorphic composition such as dialog triggers.
