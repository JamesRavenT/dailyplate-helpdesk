# API reference

The Express backend listens on port `3001` by default. In local development, the Vite frontend
proxies `/api` and `/health` to it. Request and response bodies use JSON unless noted otherwise.

## Authentication boundaries

- **Public:** no application authentication.
- **Better Auth:** handled by Better Auth itself. Individual auth operations establish, inspect,
  or end a database-backed session; public sign-up is disabled.
- **Session:** an active Better Auth session, enforced by `requireAuth`.
- **Admin:** an active `ADMIN` session, enforced by `requireAdmin`.
- **Legacy webhook secret:** the `X-Webhook-Secret` header must match `WEBHOOK_SECRET`. The route
  exists only when `NODE_ENV` is not `production`.
- **Internal token:** the `X-Internal-Token` header must match `INTERNAL_API_TOKEN`. The comparison
  is timing-safe, and the Cloudflare Worker blocks `/api/internal/*` at the public edge.

## Endpoints

| Method | Path | Auth boundary | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Return backend health and the current server timestamp. |
| `GET` | `/api` | Public | Return the API identity message. |
| Any supported by Better Auth | `/api/auth/*` | Better Auth | Grouped Better Auth operations such as sign-in, session lookup, and sign-out. Better Auth parses these requests before Express's JSON middleware. |
| `GET` | `/api/tickets` | Session | List, search, filter, sort, and paginate tickets. Agents receive only their own assigned `OPEN` or `IN_PROGRESS` tickets. Admins receive system-wide results, but `AI_PROCESSING` tickets are excluded from this endpoint. |
| `GET` | `/api/tickets/stats` | Session | Return dashboard totals and recent tickets. Agent results are calculated only from tickets assigned to that agent; admin results are system-wide. |
| `GET` | `/api/tickets/chart` | Session | Return 30-day dashboard series. Agent series are scoped by `assigned_to_id`; admin series are system-wide. |
| `GET` | `/api/tickets/by-ids?ids=…` | Session | Return up to ten tickets in requested order. Agents receive only IDs for tickets assigned to them. |
| `GET` | `/api/tickets/:id` | Session | Return a ticket and its messages. Agents are forbidden from other agents' tickets; opening their own `OPEN` ticket advances it to `IN_PROGRESS`. |
| `PATCH` | `/api/tickets/:id` | Session | Update ticket fields. Agents may update only their own tickets and cannot change assignment; admins may update any ticket and assign an active agent. |
| `POST` | `/api/tickets/:id/messages` | Session | Add an agent reply and schedule outbound email. Agents may reply only to their own tickets; admins may reply to any ticket. |
| `POST` | `/api/tickets/:id/polish` | Session | Polish a draft reply with OpenAI. Agents may use it only for their own tickets; admins may use it for any ticket. |
| `POST` | `/api/tickets/:id/summarize` | Session | Generate and store an OpenAI summary. Agents may use it only for their own tickets; admins may use it for any ticket. |
| `PATCH` | `/api/users/status` | Session | Update the current user's presence status; changing to `ONLINE` or `AWAY` also drains queued tickets into available capacity. |
| `PATCH` | `/api/users/me` | Session | Change the current user's password. |
| `PATCH` | `/api/users/me/profile` | Session | Change the current user's name and email. |
| `GET` | `/api/users/agents` | Admin | List active agents for assignment controls. |
| `GET` | `/api/users` | Admin | List all non-system users. |
| `POST` | `/api/users` | Admin | Create an agent account. |
| `PATCH` | `/api/users/:id` | Admin | Update a user's name, email, and optionally password. |
| `PATCH` | `/api/users/:id/lock` | Admin | Lock or unlock a non-admin user after administrator password confirmation; locking revokes sessions. |
| `DELETE` | `/api/users/:id` | Admin | Delete a non-admin user after administrator password confirmation and unassign their tickets. |
| `GET` | `/api/articles` | Session | List knowledge-base articles. |
| `GET` | `/api/articles/:id` | Session | Return one knowledge-base article. |
| `POST` | `/api/articles` | Admin | Create a knowledge-base article. |
| `PATCH` | `/api/articles/:id` | Admin | Replace an article's title, category, and content. |
| `DELETE` | `/api/articles/:id` | Admin | Delete a knowledge-base article. |
| `POST` | `/api/webhooks/inbound-email` | Legacy webhook secret; development only | Accept a simplified inbound-email payload, create or continue a ticket, and enqueue new tickets for triage. The route is absent in production. |
| `POST` | `/api/internal/resend-inbound` | Internal token | Accept a signature-verified Resend event forwarded by n8n. Non-`email.received` events are acknowledged and ignored; received emails enter the normal ticket pipeline. |

## Agent ticket scoping

Ticket routes share session middleware, but authorization does not stop there. The controllers
apply ownership rules using the authenticated agent's ID:

- list, dashboard, chart, and ID-batch queries filter results to that agent;
- ticket detail, update, reply, polish, and summarize operations reject tickets assigned to
  someone else;
- admins retain system-wide access, including reassignment.

This controller-level scoping is part of the API boundary and should be preserved when adding
or refactoring ticket endpoints.
