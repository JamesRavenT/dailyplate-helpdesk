# How to deploy DailyPlate Helpdesk

This guide deploys the production stack: **Cloudflare Workers** (SPA + API proxy),
**Render** (backend), **Neon** (database), and **n8n** (inbound email gateway).

```
Browser ──► Cloudflare Worker ──► Render backend ──► Neon Postgres
Resend inbound ──► n8n gateway ──► Render (/api/internal/*)
```

The browser only ever talks to the Cloudflare origin; the Worker reverse-proxies the API to
Render so session cookies stay first-party.

## Prerequisites

- A [Neon](https://neon.tech) account, a [Render](https://render.com) account, a
  [Cloudflare](https://cloudflare.com) account, and a running [n8n](https://n8n.io) instance.
- A [Resend](https://resend.com) account with a verified sending domain and inbound routing.
- An OpenAI API key.
- This repo pushed to GitHub (Render's Blueprint flow deploys from a connected Git repo).
- `wrangler` (bundled as a frontend dev dependency).

---

## 1. Provision the database (Neon)

1. Create a Neon project. From the dashboard, copy **two** connection strings:
   - the **pooled** string (host contains `-pooler`) → used at runtime,
   - the **direct** string (no `-pooler`) → used by the Prisma CLI for migrations.
2. You will set these on Render as `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).

> Prisma runtime queries and pg-boss use the pooled connection; only `prisma migrate deploy`
> needs the direct connection. See
> [architecture.md](../explanation/architecture.md#database-pooled-vs-direct-connections).

---

## 2. Deploy the backend (Render)

The repo ships a Render Blueprint at [`render.yaml`](../../render.yaml). It defines one `docker`
web service that builds [`backend/Dockerfile.prod`](../../backend/Dockerfile.prod) with the
**repo root** as the build context (`dockerContext: .`), because that Dockerfile copies from
`backend/`.

1. In the Render dashboard: **New → Blueprint**, connect this GitHub repo, and select the branch.
   Render reads `render.yaml` and proposes the `dailyplate-helpdesk-backend` service.
2. Render prompts for every variable marked `sync: false`. Fill them in (see the
   [full reference](../reference/environment-variables.md)):

   | Variable | Notes |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string |
   | `DATABASE_URL_UNPOOLED` | Neon **direct** string (migrations) |
   | `BETTER_AUTH_SECRET` | fresh 32+ char random value |
   | `BETTER_AUTH_URL` | your public **Cloudflare** URL — not known yet, see the note below |
   | `FRONTEND_URL` | your public **Cloudflare** URL — same |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | initial admin |
   | `OPENAI_API_KEY` | AI classification + polish/summary |
   | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | outbound + inbound email fetch |
   | `INTERNAL_API_TOKEN` | high-entropy; shared with the n8n workflow |
   | `SENTRY_DSN` | optional — leave blank to disable |

   `NODE_ENV=production` and `PORT=3001` are already hardcoded in `render.yaml`.

   > **Chicken-and-egg:** `BETTER_AUTH_URL` and `FRONTEND_URL` must be the Cloudflare URL, which
   > you don't have until step 3. Put the Render URL in for now — the backend also trusts
   > Render's auto-injected `RENDER_EXTERNAL_URL`, so the first boot works either way. You'll
   > correct them at the end of step 3.

3. **Apply** the Blueprint. Render builds the image and starts the service.
4. **Migrations run at container start**, not as a pre-deploy step.
   [`backend/docker-entrypoint.sh`](../../backend/docker-entrypoint.sh) runs
   `prisma migrate deploy`, then the idempotent seed (non-fatal if it fails), then `exec`s the
   server. This is because Render's `preDeployCommand` requires a **paid** instance type; a
   commented-out `preDeployCommand` line in `render.yaml` shows the paid-plan alternative.
5. Watch the deploy logs until `/health` passes the health check. **Copy the service's
   `https://….onrender.com` URL** — this is your `BACKEND_ORIGIN` for the next step.

> **Free-plan behaviour:** a free Render web service **spins down after ~15 minutes of
> inactivity** and takes roughly 30–60 seconds to cold-start on the next request. While it is
> spun down the in-process pg-boss workers do not run, so queued AI triage and the per-minute
> agent-presence sweep pause until something wakes the service. Upgrading to Starter removes the
> spin-down and unlocks `preDeployCommand`.

---

## 3. Deploy the frontend + API proxy (Cloudflare)

The Cloudflare Worker in [`frontend/worker/`](../../frontend/worker/) serves the built SPA and
reverse-proxies the API to Render.

1. Set `BACKEND_ORIGIN` in [`frontend/wrangler.jsonc`](../../frontend/wrangler.jsonc) (or as a
   per-environment Worker variable / secret) to your Render backend URL — no trailing slash.
2. Build and deploy from `frontend/`:
   ```bash
   cd frontend
   npm run cf:deploy      # vite build && wrangler deploy
   ```
3. Note the Worker's public URL. This is the app's canonical URL — go back to **Render →
   Environment**, set `BETTER_AUTH_URL` and `FRONTEND_URL` to it, and save (Render redeploys
   automatically).

The Worker forwards cookies and `Set-Cookie` unchanged, sets `X-Forwarded-*` headers, and
returns a `502` if the backend is unreachable. `/api/internal/*` is blocked at the edge.

> On the free plan, the first request after an idle period passes through the Worker to a cold
> backend. If the Worker times out before Render finishes waking, retry once.

---

## 4. Set up the inbound email gateway (n8n)

The n8n workflow receives the Resend inbound webhook, verifies its Svix signature, and forwards
the event to the Render internal endpoint. See [`n8n/README.md`](../../n8n/README.md) for the
importable workflow and step-by-step setup.

1. Import `n8n/workflows/resend-inbound-gateway.json` into your n8n instance.
2. Set one n8n **environment variable** (read via `$env` by the Code node):
   - `RESEND_INBOUND_SECRET` — the Resend inbound signing secret (Svix, `whsec_…`).

   The **Verify Svix Signature** Code node has two independent runtime requirements:

   - Set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` on the n8n instance so the node can read
     `RESEND_INBOUND_SECRET` through `$env`.
   - If task runners are enabled, allow the built-in `crypto` module with an `env-override` in
     `/etc/n8n-task-runners.json`. A container environment variable is not sufficient:

     ```json
     { "task-runners": [ { "runner-type": "javascript",
         "env-overrides": { "NODE_FUNCTION_ALLOW_BUILTIN": "crypto" } } ] }
     ```

     Without this task-runner setting, `require('crypto')` fails with
     `Module 'crypto' is disallowed`.

   The export contains the placeholder
   `https://your-backend.onrender.com/api/internal/resend-inbound` on the **Forward to
   Helpdesk** node. After import, replace `your-backend` with your Render service hostname.
   Keep the `onrender.com` origin rather than the Cloudflare domain because
   `/api/internal/*` is blocked at the Cloudflare edge by design.
3. Create a **Header Auth** credential (header `X-Internal-Token`, value = the same
   `INTERNAL_API_TOKEN` set on Render) **and select it on the `Forward to Helpdesk` node**.
   Creating it without selecting it leaves the forward call unauthenticated.
4. Activate the workflow and copy its production webhook URL.
5. In Resend, point the **inbound** webhook at the n8n webhook URL.

See [`n8n/README.md`](../../n8n/README.md) for the full node-by-node breakdown.

---

## 5. Verify

- Open the Cloudflare URL and sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- Send a test email to your Resend inbound address; confirm a ticket appears and (for a
  policy-only question) an AI reply is sent in-thread. On the free plan, allow for a cold start
  before assuming the pipeline is broken.
- Run the deployment smoke test (see [testing-strategy.md](../explanation/testing-strategy.md)).

---

## Before you go live — security checklist

- [ ] **Rotate** the OpenAI and Resend API keys if any dev value was ever exposed.
- [ ] **Generate a fresh** `BETTER_AUTH_SECRET` (don't reuse the dev one).
- [ ] **Generate a strong** `INTERNAL_API_TOKEN` and set the same value on Render **and** n8n.
- [ ] Use a strong `SEED_ADMIN_PASSWORD`.
- [ ] Confirm `backend/.env` is **not** committed (it is gitignored).
- [ ] Confirm `BETTER_AUTH_URL` / `FRONTEND_URL` are the Cloudflare URL, not the Render URL.
