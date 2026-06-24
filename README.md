# Helpdesk — AI-Powered Support Ticketing System

A full-stack customer-support helpdesk that turns inbound emails into tickets, uses AI to
classify and (where safe) auto-resolve them, and routes everything else to human agents with
an AI reply assistant at their side.

> **Why it exists:** Traditional email helpdesks are slow at high volume and lean on canned
> replies that feel impersonal. This app lets AI handle the easy, policy-only questions
> instantly while making sure anything account-specific or sensitive reaches a real agent —
> with the whole conversation kept inside one email thread.

---

## Table of Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Local development](#local-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)

---

## Features

### AI ticket automation
- **Email-to-ticket** — inbound customer emails become tickets automatically via a
  signature-verified Resend webhook. Replies in an existing thread are appended to the
  matching ticket (matched on the email `In-Reply-To` header).
- **AI classification** — every new ticket is classified by **category** (Account, Inquiry,
  Refund, Technical, Voucher, Other) and **priority** (Low / Medium / High).
- **AI auto-resolution** — for questions answerable with general, policy-only information
  (how-to, pricing tiers, refund/cancellation *policy*, voucher instructions), the AI writes
  and sends a complete, personalized reply in the same email thread and marks the ticket
  `AI_RESOLVED`. It is explicitly constrained to **never** claim to take account-specific
  actions (no refunds, password resets, lookups).
- **Smart human routing** — anything requiring account access or judgment (billing disputes,
  login issues, bug reports) is routed to a human agent instead.
- **Auto-reopen** — if a customer replies to an AI-resolved ticket, it reopens to `OPEN` and
  is queued for an agent.
- **Async processing** — AI work runs off the request path on a **pg-boss** job queue, so
  webhook responses stay fast and processing is retry-safe.

### Agent workflow
- **Round-robin assignment** — tickets are distributed across agents who are `ONLINE`/`AWAY`,
  load-aware with a cap of 5 concurrent open tickets per agent; overflow waits in a queue.
- **Agent presence** — agents set their status (Online / Away / Meeting / Offline); going
  online drains queued tickets to them.
- **Threaded replies** — agent replies are emailed to the customer inside the original thread.
- **AI "Polish" assistant** — one click rewrites an agent's draft reply for clarity, tone, and
  grammar while preserving intent.
- **AI ticket summary** — generates a concise 2–4 sentence summary of a ticket thread so
  agents can get up to speed instantly.
- **Ticket list** — server-side search, category/status filtering, column sorting, and
  pagination; agents see only their assigned tickets, admins see everything.
- **Ticket detail** — full conversation thread, reply box, and an update panel for status,
  priority, category, and assignment.

### Admin
- **Dashboard** — a 30-day activity area chart plus stat cards. Admins see tickets received vs.
  resolved (split by AI vs. agents) and critical/ongoing counts; agents see a personal view.
  Includes a "New Tickets" slideshow and an online-agents panel.
- **User management** — create, edit, lock/unlock, and delete agent accounts. Destructive
  actions (delete / lock) require the admin to re-enter their own password; locking also
  revokes the user's active sessions.

### Platform
- **Role-based access** — `ADMIN` and `AGENT` roles enforced on every API route.
- **Error monitoring** — Sentry on both backend and frontend (no-ops when no DSN is set).

---

## How it works

```
Customer email
      │
      ▼
Resend Inbound ──(signed webhook)──►  POST /api/webhooks/resend-inbound
                                              │
                                              ▼
                                     Create / update Ticket  ──►  pg-boss queue
                                                                       │
                                                       ┌───────────────┴────────────────┐
                                                       ▼                                 ▼
                                          AI: classify + can resolve?            (queued job)
                                                       │
                          ┌────────────────────────────┴───────────────────────────┐
                          ▼ yes (policy-only)                                        ▼ no
                 AI writes reply → email in-thread                        Round-robin → assign agent
                 status = AI_RESOLVED                                      status = OPEN
                          │                                                          │
            customer replies? → reopen (OPEN)                          agent replies / resolves / closes
```

The ticket status flow: `AI_PROCESSING → AI_RESOLVED` (auto) **or** `→ OPEN → IN_PROGRESS →
RESOLVED → CLOSED` (human). A customer reply to an `AI_RESOLVED` ticket sends it back to `OPEN`.

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 6 |
| **UI** | Tailwind CSS v4, shadcn/ui (base-nova) on `@base-ui/react`, lucide-react icons, Recharts |
| **Data fetching** | TanStack Query, TanStack Table, Axios |
| **Forms / validation** | React Hook Form + Zod |
| **Routing** | React Router v6 |
| **Backend** | Express 4 on the **Bun** runtime, TypeScript |
| **Auth** | [Better Auth](https://www.better-auth.com/) — email/password, DB sessions, custom roles |
| **ORM / DB** | Prisma 7 (driver adapter `@prisma/adapter-pg`) + PostgreSQL 16 |
| **Job queue** | pg-boss (Postgres-backed) |
| **AI** | Vercel AI SDK (`ai`, `@ai-sdk/openai`) with OpenAI **gpt-4.1-nano** (`generateObject` for classification, `generateText` for polish/summary) |
| **Email** | Resend — outbound replies + inbound webhook (Svix-signed) |
| **Validation / security** | Zod, Helmet, CORS, express-rate-limit |
| **Monitoring** | Sentry (`@sentry/node`, `@sentry/react`) |
| **Testing** | Vitest + React Testing Library (component), Playwright (E2E) |
| **Deployment** | Docker (single-service image), Railway |

---

## Architecture

- **Backend** is a thin Express app: routes → controllers → Prisma. Better Auth mounts its own
  handler at `/api/auth/*` (before `express.json`, since it parses its own bodies). Inbound AI
  work is enqueued to pg-boss and handled by a worker so HTTP requests return immediately.
- **Frontend** is a Vite SPA. In dev it runs on its own server and proxies `/api` → backend;
  in production the backend serves the built SPA from the same origin (see
  [Deployment](#deployment)), which keeps session cookies first-party and avoids CORS.
- **Auth** is database-session based (no JWTs). Sessions live in the Postgres `session` table
  with a 7-day expiry. **Sign-up is disabled** — the first admin is seeded, and further users
  are created by admins from the UI.

---

## Project structure

```
helpdesk/
├── Dockerfile              # Production single-service image (builds SPA + serves from Express)
├── railway.toml            # Railway build/deploy config
├── docker-compose.yml      # Local dev: postgres + backend + frontend + test db
├── DEPLOY.md               # Railway deployment guide + env var reference
├── backend/
│   ├── src/
│   │   ├── index.ts        # App entry (middleware, routes, SPA serving, boss startup)
│   │   ├── instrument.ts   # dotenv + Sentry init (imported first)
│   │   ├── controllers/    # tickets, users, webhooks
│   │   ├── routes/         # route definitions
│   │   ├── middleware/     # requireAuth / requireAdmin, error handler
│   │   └── lib/            # auth, prisma, boss (queue + AI), email
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/     # committed migration history
│       └── seed.ts         # creates the initial admin
└── frontend/
    └── src/
        ├── pages/          # Login, Home (dashboard), Tickets, TicketDetail, Users, NotFound
        ├── components/     # Navbar, route guards, shared UI
        ├── lib/            # auth-client, utils
        └── instrument.ts   # Sentry init (imported first)
```

### Routes

| Path | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/` | Dashboard | Authenticated |
| `/tickets` | Ticket list | Authenticated |
| `/tickets/:id` | Ticket detail | Authenticated (agents: own tickets) |
| `/users` | User management | Admin only |

---

## Local development

### Prerequisites
- [Bun](https://bun.sh) v1.x
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (for PostgreSQL)

### 1. Install dependencies
```bash
cd backend  && bun install && cd ..
cd frontend && bun install && cd ..
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# Fill in: BETTER_AUTH_SECRET, OPENAI_API_KEY, RESEND_* , SEED_ADMIN_*
```
See `backend/.env.example` for the full list.

### 3. Start PostgreSQL
```bash
docker compose up postgres -d      # exposes localhost:5433
```

### 4. Migrate + seed the admin
```bash
cd backend
bun run prisma:deploy   # apply migrations
bun run prisma:seed     # create the SEED_ADMIN_* account
```

### 5. Run the apps
```bash
# terminal 1
cd backend  && bun run dev     # http://localhost:3001
# terminal 2
cd frontend && bun run dev     # http://localhost:5173
```
The frontend proxies `/api` and `/health` to the backend, so there are no CORS issues in dev.
Log in at `/login` with your `SEED_ADMIN_*` credentials.

---

## Testing

```bash
# Component tests (Vitest + React Testing Library)
cd frontend && npm run test:component     # CI run
cd frontend && npm run test:watch         # watch mode

# E2E tests (Playwright) — needs the test database
docker compose up postgres-test -d
cd e2e && npm test
```
Test layering: UI logic is covered by fast component tests; E2E is reserved for things that
need the real backend (webhook → DB → API → UI pipelines, backend-enforced authorization,
real mutations). See `CLAUDE.md` for the full testing strategy.

---

## Deployment

Deploys as a **single Railway service**: the Express backend serves both the REST API and the
built React SPA from one origin, backed by a Railway Postgres plugin.

```
Browser ──► your-app.up.railway.app (Express)
              ├─ /api ....... REST API + Better Auth
              ├─ /health .... healthcheck
              └─ /* ......... built SPA
```

The root `Dockerfile` builds the frontend, bundles it into the backend image (`./public`), and
on boot runs `prisma migrate deploy` → seed (idempotent) → start. Full step-by-step
instructions and the environment-variable reference are in **[DEPLOY.md](./DEPLOY.md)**.

---

## Security

Implemented protections:
- **Authentication & roles** — Better Auth with DB sessions; `requireAuth` / `requireAdmin`
  on every route; agents are scoped to their own tickets in all queries.
- **Input validation** — Zod schemas on all request bodies and query params.
- **SQL safety** — Prisma everywhere; raw analytics queries use parameterized tagged templates.
- **Webhook integrity** — Resend webhooks are Svix-signature verified; the legacy shared-secret
  webhook uses a timing-safe comparison and is disabled in production.
- **Admin re-auth** — deleting or locking a user requires the admin's password; locking also
  revokes the target's sessions.
- **Hardening** — Helmet headers, locked-down CORS, a global API rate limiter plus a stricter
  sign-in limiter, a 100 kb body cap, generic error responses (no stack-trace leakage), and
  `trust proxy` for correct client-IP handling behind Railway.

> Secrets are provided via environment variables and are never committed. Rotate any keys before
> deploying to production — see the checklist in [DEPLOY.md](./DEPLOY.md).
</content>
