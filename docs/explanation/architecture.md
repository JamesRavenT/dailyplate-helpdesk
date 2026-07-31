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

### Replies to an existing thread

A reply matched to an existing ticket reopens it to `OPEN` from any of `AI_RESOLVED`,
`IN_PROGRESS`, `RESOLVED`, or `CLOSED` — a customer who writes back must never land in a closed
ticket nobody is watching. Reopening does not re-run AI triage. Only the `AI_RESOLVED` case clears
`assigned_to_id` and resets `is_ai_handled` to `false`, so the ticket returns to the queue and a
later human resolution is not counted as AI-resolved. A ticket resolved or closed by a person keeps
its assignee and reappears in that agent's queue, which is scoped to `OPEN`/`IN_PROGRESS`.

**Known limitation — dashboard metrics are current-state, not historical.** Every "resolved"
figure, including the 30-day activity chart, is derived from each ticket's status *right now*;
there is no `resolved_at` column or status history in the schema. Reopening a ticket therefore
removes it from the resolved counts for the day it was originally resolved, rather than recording
"resolved, then reopened". Fixing this properly needs a status-history model.

Quoted text is stripped from the stored message so agents read only what the customer just wrote.
The plain-text path drops `>`-prefixed blocks, original/forwarded-message separators, and `On …
wrote:` attributions including the multi-line form Gmail produces when the attribution wraps before
`wrote:`. The HTML path removes `blockquote` and Gmail/Outlook quote containers, converts block tags
to newlines, and decodes entities — the newline handling matters, because collapsing all whitespace
would leave the quote stripper with no line structure to work with. If stripping would empty the
body entirely, the raw text is kept rather than storing a blank message.

## Asynchronous AI processing

New tickets are enqueued to **pg-boss** and processed by a worker off the request path, so
webhook/API responses return immediately. pg-boss automatically retries failed jobs, but the
batch handler has no idempotency guard; a retry after partial processing could repeat effects.
The AI is constrained by prompt to answer only policy-only questions and to never claim
account-specific actions; if it can't safely resolve, the ticket is round-robin assigned to an
available agent (load-capped at 5 concurrent open tickets each).

**Known issue — agent availability differs between two assignment paths.** New-ticket
round-robin assignment selects only agents whose status is `ONLINE`. Queue draining runs when an
agent changes status to either `ONLINE` or `AWAY`, so an `AWAY` agent can receive queued work
through that separate path. This inconsistency is not intentional and needs follow-up.

## Authentication

Database-session based (no JWTs), via Better Auth. Sessions live in the Postgres `session`
table with a 1-hour expiry and a 5-minute refresh age. **Sign-up is disabled** — the first admin
is seeded and further users are created by admins from the UI. Roles (`ADMIN` / `AGENT`) are a custom field on the user and
enforced by `requireAuth` / `requireAdmin` on protected business-data routes. Public health and
API-root endpoints, Better Auth's own handler, the development-only shared-secret webhook, and
the token-authenticated internal routes have separate boundaries.

### Inactivity timeout

Agents are signed out after 60 minutes without interaction, with a warning dialog at 55 minutes.

The mechanism is not obvious, and the obvious implementation does not work. `requireAuth` resolves
the session by calling `auth.api.getSession()` internally and never forwards Better Auth's
refreshed `Set-Cookie` onto the Express response — only `/api/auth/*` routes pass through the real
Better Auth handler. So ordinary API traffic cannot slide the browser cookie. At the same time the
dashboard polls every 15–30 seconds, which means a purely server-side rolling window would never
expire while a tab sat open, and a purely server-side fixed window would sign out an agent in the
middle of active work.

Idle is therefore measured client-side from genuine interaction (`useIdleLogout`), and the cookie
is refreshed by an explicit `authClient.getSession()` call on real user activity, throttled to once
every five minutes. Activity is shared between tabs through `localStorage`. The 1-hour server
expiry is the backstop for a closed or backgrounded tab. Idle is evaluated on a single 30-second
tick rather than a timer per input event, so the warning and the logout can fire up to 30 seconds
late.

A global axios response interceptor (`lib/http.ts`) ends the session on `401 {"error":"Unauthorized"}`
or `403 {"error":"Account is locked"}`. It deliberately matches those exact shapes rather than any
401, because the admin delete/lock dialogs use `401 {"error":"Incorrect password"}` for a mistyped
confirmation password and must keep surfacing that in place. Sign-out is funnelled through one
guarded `endSession()` helper (`lib/session.ts`) shared by the interceptor, the idle timer, and the
manual sign-out button, so a failing request and a deliberate sign-out cannot race.

## Frontend design system

The UI is a cohesive operations-console design system rather than ad-hoc styling: a dark
sidebar app shell, a semantic status/priority color language (kept distinct from the brand
accent), Geist for UI text and Geist Mono for data/IDs/metrics, and shared loading/empty/error
states. Primitives are shadcn/ui (base-nova) on `@base-ui/react`; the `Button` renders a native
`<button>` for ordinary actions (so `disabled` is a real HTML state) and defers to Base UI only
for polymorphic composition such as dialog triggers.
