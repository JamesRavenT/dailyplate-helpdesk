# Screenshots & assets

This folder holds the images used in the project README and docs.

Guidelines for images kept here:

- Use seeded demo data and the seeded test users only.
- **No** real credentials, personal information, private URLs, API keys, or production data.
- Prefer current, representative screens (dashboard, ticket list, ticket detail, knowledge base,
  login) at a consistent viewport.

## Current assets

Captured at 1440×900 from the running app against seeded demo data, via the opt-in Playwright
`screenshots` project (`CAPTURE_SCREENSHOTS=1 npx playwright test --project=screenshots` from `e2e/`):

| File | Screen |
|---|---|
| `dashboard-admin.png` | Admin dashboard (chart, stats, carousels, online agents) |
| `tickets.png` | Ticket queue (list, filters, statuses) |
| `ticket-detail.png` | Ticket detail (thread + update panel) |
| `resources.png` | Knowledge base (SOP articles) |
| `users.png` | User management (roles, status, availability) |
| `login.png` | Sign-in page |

All use seeded demo data (fictional names + `@dailyplate.example` addresses) and the demo
`admin@test.com` / `agent@test.com` accounts only — no real credentials, personal data, or
private URLs.
