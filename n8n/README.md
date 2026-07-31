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
| **Resend Inbound Webhook** | `POST` webhook (`/webhook/resend-inbound`), raw body enabled, responds via the Respond node. |
| **Verify Svix Signature** | Recomputes the Svix `v1` HMAC-SHA256 over `id.timestamp.rawBody` using `RESEND_INBOUND_SECRET`, with a 5-minute timestamp tolerance and a timing-safe compare. |
| **Signature Valid?** | Routes valid events to the forwarder, invalid ones to a 401 response. |
| **Forward to Helpdesk** | `POST`s the **original raw payload** to the backend's `/api/internal/resend-inbound` (URL hardcoded on the node) with the `X-Internal-Token` header. `neverError`/`fullResponse` so the upstream status can be relayed. |
| **Respond With Upstream Status** | Returns the backend's status code to Resend. Non-2xx (or an execution error) makes Resend retry. |
| **Respond 401** | Returned when the signature is invalid. |

## Setup

1. **Import** `workflows/resend-inbound-gateway.json` into your n8n instance
   (Workflows → Import from File). A fresh webhook ID is generated on import.
2. **Set one environment variable** on the n8n instance:
   - `RESEND_INBOUND_SECRET` — the Resend inbound signing secret (Svix, `whsec_…`).

   The **Verify Svix Signature** Code node has two independent runtime requirements:

   1. **Allow `$env` access:** set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` on the n8n instance.
      Without it, the node cannot read `RESEND_INBOUND_SECRET`, verification fails with
      `missing_secret`, and every webhook returns 401.
   2. **Allow the built-in `crypto` module:** when task runners are enabled, add this
      `env-override` to `/etc/n8n-task-runners.json` (a container environment variable is not
      sufficient):

      ```json
      { "task-runners": [ { "runner-type": "javascript",
          "env-overrides": { "NODE_FUNCTION_ALLOW_BUILTIN": "crypto" } } ] }
      ```

      Without this task-runner setting, the node fails at `require('crypto')` with
      `Module 'crypto' is disallowed`.

   The backend URL is **hardcoded** on the **Forward to Helpdesk** node rather than read from
   `$env` — it is a public URL, not a secret, so the indirection bought nothing and was one more
   thing to misconfigure. The export uses
   `https://your-backend.onrender.com/api/internal/resend-inbound`; after import, replace
   `your-backend` with your Render service hostname in that node's URL field.
3. **Create the credential** the forwarder uses — a **Header Auth** (`httpHeaderAuth`)
   credential, then select it on the **Forward to Helpdesk** node:
   - **Name:** `X-Internal-Token`
   - **Value:** the same `INTERNAL_API_TOKEN` value set on Render.

   The credential's own display name is arbitrary — only the header name and value matter.
   Creating the credential is not enough on its own: it must also be **selected on the node**,
   or the forward call goes out unauthenticated and the backend rejects it with 401.
4. **Activate** the workflow and copy the production webhook URL
   (`https://<your-n8n-host>/webhook/resend-inbound`).
5. In **Resend**, point the **inbound** webhook at that URL.

## Secrets

Nothing secret is stored in the exported JSON. The Svix secret comes from an n8n environment
variable and the internal token from an n8n credential you create by hand. The backend URL is
inlined in the node, which is fine — it is public. Keep it that way: **never** paste the Svix
secret or the internal token into node parameters, or they land in this JSON on the next export.

## Testing

- **Invalid signature** → `401` (Resend will retry; fix the secret if this is unexpected).
- **Valid, non-`email.received` event** → backend returns `200 { ignored: true }`, relayed to Resend.
- **Valid `email.received`** → backend creates/updates the ticket and returns `200`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A `$env` expression shows **red** in the editor; every request 401s | n8n 2.x blocks `$env` by default | Set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` and restart n8n |
| Verification always fails with `missing_secret` | `RESEND_INBOUND_SECRET` unset, or `$env` blocked | Set the variable **and** allow `$env` access |
| Verification fails with `Module 'crypto' is disallowed` | Task runners do not allow the built-in `crypto` module | Add `NODE_FUNCTION_ALLOW_BUILTIN=crypto` under `env-overrides` in `/etc/n8n-task-runners.json`, then restart n8n and its task runners |
| Forward returns `401` from the backend | Credential created but **not selected** on the `Forward to Helpdesk` node | Open the node → *Credential for Header Auth* → select it → save → republish |
| Forward returns `404` | The node's URL points at the public Cloudflare domain | Use the `onrender.com` URL — `/api/internal/*` is blocked at the Cloudflare edge by design |

> **Restarting matters.** Environment variables are read once at process start. Editing
> `docker-compose.yml` and running `docker restart` reuses the old environment — use
> `docker compose up -d`, which recreates the container. Validate first with `docker compose config`.

The backend side of this contract (`/api/internal/*` auth boundary and event handling) is
covered by `e2e/tests/internal.spec.ts`.
