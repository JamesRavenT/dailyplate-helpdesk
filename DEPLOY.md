# Deploying to Railway

This app deploys as a **single Railway service**: the Express backend serves the API *and*
the built React SPA from the same origin. A separate **Postgres** plugin provides the database.

## Architecture

```
Browser ──► your-app.up.railway.app (Express)
              ├─ /api ........ REST API + Better Auth
              ├─ /health ..... healthcheck
              └─ /* .......... built SPA (frontend/dist served from ./public)
```

Same origin → no CORS, first-party session cookies. The frontend talks to `/api` relatively,
so no API base URL needs to be configured.

## Build

Railway builds the root [`Dockerfile`](./Dockerfile) (configured in [`railway.toml`](./railway.toml)):

1. Stage 1 builds the frontend (`bun run build` → `frontend/dist`).
2. Stage 2 installs the backend, runs `prisma generate`, and copies the SPA into `./public`.
3. On boot the container runs `prisma migrate deploy`, seeds the admin (idempotent), then starts.

## Steps

1. **Create the project** — new Railway project from this GitHub repo. Railway detects the root `Dockerfile`.
2. **Add Postgres** — add the Postgres plugin. It injects `DATABASE_URL` into the service automatically.
3. **Set environment variables** on the service (see table below).
4. **Deploy.** Once live, open the app and log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
5. **Resend inbound webhook** — point your Resend inbound webhook at
   `https://your-app.up.railway.app/api/webhooks/resend-inbound` and set `RESEND_INBOUND_SECRET` to match.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Provided automatically by the Railway Postgres plugin. |
| `NODE_ENV` | ✅ | Set to `production`. (Also hard-set in the Dockerfile.) |
| `BETTER_AUTH_SECRET` | ✅ | **Generate a fresh 32+ char random value** — do not reuse the dev secret. |
| `BETTER_AUTH_URL` | ✅ | Your public app URL, e.g. `https://your-app.up.railway.app`. |
| `FRONTEND_URL` | ✅ | Same public app URL (used for CORS + trusted origins). |
| `SEED_ADMIN_EMAIL` | ✅ | Initial admin login, created on first boot. |
| `SEED_ADMIN_PASSWORD` | ✅ | Initial admin password. |
| `OPENAI_API_KEY` | ✅ | **Rotate before deploy** (the dev key was exposed). Used for AI classification/polish/summary. |
| `RESEND_API_KEY` | ✅ | **Rotate before deploy.** Outbound + inbound email. |
| `RESEND_FROM_EMAIL` | ✅ | Verified sender address. |
| `RESEND_INBOUND_SECRET` | ✅ | Resend inbound webhook signing secret. |
| `SENTRY_DSN` | optional | Backend error reporting. Leave blank to disable. |
| `VITE_SENTRY_DSN` | optional | Frontend Sentry DSN — **build-time**. Set as a build arg/variable, not just runtime. |
| `PORT` | — | Railway sets this automatically; the app reads `process.env.PORT`. |

> `WEBHOOK_SECRET` and the legacy `/api/webhooks/inbound-email` route are **disabled in production** —
> production inbound email goes through the signature-verified Resend webhook.

## Before you deploy — security checklist

- [ ] **Rotate** the OpenAI and Resend API keys (the dev values in `backend/.env` were exposed).
- [ ] **Generate a new** `BETTER_AUTH_SECRET` for production (don't reuse the dev one).
- [ ] Use a strong `SEED_ADMIN_PASSWORD`.
- [ ] Confirm `backend/.env` is **not** committed (it is gitignored — verified clean).
