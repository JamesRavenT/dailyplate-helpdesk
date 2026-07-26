# n8n — Resend inbound-email gateway

This folder holds the n8n workflow that is the **front door** for inbound customer email.
Resend delivers each inbound email to this workflow; the workflow verifies the webhook's
Svix signature and forwards valid events to the Helpdesk backend's internal endpoint. All
ticket logic (thread matching, ticket creation, round-robin routing, AI triage) stays in the
tested TypeScript backend — see [../docs/explanation/architecture.md](../docs/explanation/architecture.md).

```
Resend inbound ──► n8n (verify Svix signature) ──► POST /api/internal/resend-inbound (Render)
```

## Flow

| Node | Role |
|---|---|
| **Resend Inbound Webhook** | `POST` webhook (`/webhook/.../resend-inbound`), raw body enabled, responds via the Respond node. |
| **Verify Svix Signature** | Recomputes the Svix `v1` HMAC-SHA256 over `id.timestamp.rawBody` using `RESEND_INBOUND_SECRET`, with a 5-minute timestamp tolerance and a timing-safe compare. |
| **Signature Valid?** | Routes valid events to the forwarder, invalid ones to a 401 response. |
| **Forward to Helpdesk** | `POST`s the **original raw payload** to `HELPDESK_BACKEND_URL/api/internal/resend-inbound` with the `X-Internal-Token` header. `neverError`/`fullResponse` so the upstream status can be relayed. |
| **Respond With Upstream Status** | Returns the backend's status code to Resend. Non-2xx (or an execution error) makes Resend retry. |
| **Respond 401** | Returned when the signature is invalid. |

## Setup

1. **Import** `workflows/resend-inbound-gateway.json` into your n8n instance
   (Workflows → Import from File). A fresh webhook ID is generated on import.
2. **Set two environment variables** on the n8n instance (the Code and HTTP nodes read these
   via `$env`, so `N8N_BLOCK_ENV_ACCESS_IN_NODE` must not be `true`):
   - `RESEND_INBOUND_SECRET` — the Resend inbound signing secret (Svix, `whsec_…`).
   - `HELPDESK_BACKEND_URL` — the Render backend base URL (no trailing slash), e.g.
     `https://dailyplate-helpdesk-backend.onrender.com`.
3. **Create the credential** the forwarder uses — an **Header Auth** (`httpHeaderAuth`)
   credential named **`DailyPlate Internal Token`**:
   - **Name:** `X-Internal-Token`
   - **Value:** the same `INTERNAL_API_TOKEN` value set on Render.
4. **Activate** the workflow and copy the production webhook URL
   (`https://<your-n8n-host>/webhook/<id>/resend-inbound`).
5. In **Resend**, point the **inbound** webhook at that URL.

## Secrets

Nothing secret is stored in the exported JSON. The Svix secret and backend URL come from n8n
environment variables; the internal token comes from an n8n credential you create by hand. Keep
it that way — do not paste tokens into node parameters before committing.

## Testing

- **Invalid signature** → `401` (Resend will retry; fix the secret if this is unexpected).
- **Valid, non-`email.received` event** → backend returns `200 { ignored: true }`, relayed to Resend.
- **Valid `email.received`** → backend creates/updates the ticket and returns `200`.

The backend side of this contract (`/api/internal/*` auth boundary and event handling) is
covered by `e2e/tests/internal.spec.ts`.
