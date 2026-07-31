# Environment variables reference

All secrets are provided via environment variables and are never committed. Annotated templates
live in [`backend/.env.example`](../../backend/.env.example) and
[`frontend/.env.example`](../../frontend/.env.example).

## Backend (Render / local `backend/.env`)

On Render these are declared in [`render.yaml`](../../render.yaml). Everything marked
`sync: false` there is **not** stored in the repo — Render prompts you for the value in the
dashboard when you create or sync the Blueprint.

| Variable | Required | Description |
|---|---|---|
| `PORT` | — | Server port. Set to `3001` in `render.yaml` to match the image's `EXPOSE`. |
| `NODE_ENV` | ✅ | `development`, `test`, or `production`. |
| `DATABASE_URL` | ✅ | Neon **pooled** connection (`-pooler` host). Used by Prisma runtime + pg-boss. |
| `DATABASE_URL_UNPOOLED` | ✅ (prod) | Neon **direct** connection. Used by the Prisma CLI for migrations. Falls back to `DATABASE_URL` locally. |
| `BETTER_AUTH_SECRET` | ✅ | 32+ char random secret for Better Auth. |
| `BETTER_AUTH_URL` | ✅ | Public app URL. In production this is the **Cloudflare** URL. |
| `FRONTEND_URL` | ✅ | Trusted origin. In production this is the **Cloudflare** URL. |
| `SEED_ADMIN_EMAIL` | ✅ | Initial admin email (seeded on first boot, idempotent). |
| `SEED_ADMIN_PASSWORD` | ✅ | Initial admin password. |
| `AI_PROVIDER` | — | `openai` (default when unset) or deterministic `stub`. The stub is rejected when `NODE_ENV=production`. |
| `OPENAI_API_KEY` | ✅ | OpenAI key — inbound triage **and** ticket summarize/polish. |
| `RESEND_API_KEY` | ✅ | Resend key — outbound replies + inbound email fetch. |
| `RESEND_FROM_EMAIL` | ✅ | Verified sender address. |
| `INTERNAL_API_TOKEN` | ✅ | High-entropy token guarding `/api/internal/*`. Must match the value in the n8n workflow. Startup fails in production if unset. |
| `RESEND_INBOUND_SECRET` | — | Resend/Svix inbound signing secret. **Now used by the n8n gateway**, not the backend. |
| `WEBHOOK_SECRET` | — | Legacy shared-secret webhook — local testing only, disabled in production. |
| `SENTRY_DSN` | — | Backend error reporting (no-op when blank). |
| `RENDER_EXTERNAL_URL` | auto | Injected by Render — the service's own `https://….onrender.com` URL. Appended to Better Auth's `trustedOrigins` as a fallback so auth still works if `FRONTEND_URL` / `BETTER_AUTH_URL` are unset or mid-rollout. Never set this yourself. |

## Frontend (build-time / `frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SENTRY_DSN` | — | Frontend Sentry DSN, inlined at build time (no-op when blank). |
| `SENTRY_AUTH_TOKEN` | — | Enables Sentry source-map upload during `vite build` (optional). |
| `SENTRY_ORG` | — | Sentry org (with the auth token). |
| `SENTRY_PROJECT` | — | Sentry project (with the auth token). |

> The Cloudflare Worker's `BACKEND_ORIGIN` (the Render backend URL) is configured in
> [`frontend/wrangler.jsonc`](../../frontend/wrangler.jsonc) as a per-environment Worker
> variable — **not** in `.env`.

## E2E (`backend/.env.test.example` / process environment)

The checked-in [`backend/.env.test.example`](../../backend/.env.test.example) is the local E2E
fixture; there is no loaded `e2e/.env` file. The fixture is passed to the backend by
[`e2e/playwright.config.ts`](../../e2e/playwright.config.ts), parsed by
[`e2e/global-setup.ts`](../../e2e/global-setup.ts), and read by
[`e2e/tests/internal.spec.ts`](../../e2e/tests/internal.spec.ts). Playwright also sets or
overrides selected process variables for each run.

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | default suite | Set to `stub` by the fixture and Playwright for deterministic, network-free triage. The opt-in real-AI run overrides it to `openai`. |
| `DEPLOYED_BASE_URL` | — | Target URL for the opt-in deployment smoke test project. |
| `RUN_REAL_OPENAI` | — | Set to `1` to include the opt-in, paid `real-openai` Playwright project. Requires `OPENAI_API_KEY`. |
| `OPENAI_API_KEY` | real AI only | Real key forwarded only to the opt-in project; the default suite explicitly blanks it for the backend child process. |
