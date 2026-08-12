# Screenshots & assets

This folder holds the images used in the project README and docs.

Guidelines for images kept here:

- Use seeded demo data and the seeded test users only.
- **No** real credentials, personal information, private URLs, API keys, or production data.
- Prefer current, representative screens (dashboard, ticket list, ticket detail, knowledge base,
  login) at a consistent viewport.

## Current assets

Captured from the running app against seeded demo data, via the opt-in Playwright `screenshots`
project (`CAPTURE_SCREENSHOTS=1 npx playwright test --project=screenshots` from `e2e/`):

| File | Screen |
|---|---|
| `dashboard-admin.png` | Admin dashboard (chart, stats, carousels, online agents) |
| `tickets.png` | Ticket queue (list, filters, statuses) |
| `ticket-detail.png` | Ticket detail (thread + update panel) |
| `resources.png` | Knowledge base (SOP articles) |
| `users.png` | User management (roles, status, availability) |
| `login.png` | Sign-in page |

The pixels match the current seed fixtures: fictional customers at `@example.com`, seeded agents at
`@dailyplate.example`, and the `admin@test.com` / `agent@test.com` demo accounts. They contain no
real credentials, personal data, private URLs, or production content.

### Image height

The viewport is 1440×900, but the images are **not** all 900px tall. The app sidebar is
`position: fixed`, so it is sized to the viewport rather than the document — on a page taller than
the viewport, a `fullPage` screenshot would stitch a tall image with the sidebar painting only its
top 900px and bare background below it. The `capture()` helper in
`e2e/tests/screenshots/capture.screens.spec.ts` therefore measures `document.documentElement.scrollHeight`
and grows the viewport to match before shooting, restoring it afterwards. Pages that fit come out
1440×900; taller ones (dashboard, ticket queue) come out at their natural height with a full-height
sidebar. This is a capture concern only — the app itself is correct in a real browser.

A copy of all six images also lives in [`../case-study/images/`](../case-study/images/) for the
case study. **Re-capturing does not update those** — copy them across afterwards.

### Re-capturing

The screenshots render whatever is in the **test** database, so seed it before capturing:

```bash
docker compose up postgres-test -d
cd backend
bun run --env-file=.env.test.example prisma/seed.ts          # 46 SOP articles
bun run --env-file=.env.test.example prisma/seedAgents.ts    # 5 demo agents, mixed availability
bun run --env-file=.env.test.example prisma/seedTickets.ts   # varied statuses and priorities
bun run --env-file=.env.test.example prisma/addTickets.ts    # general questions for the AI path
cd ../e2e
CAPTURE_SCREENSHOTS=1 npx playwright test --project=screenshots
```

Every seed above is idempotent — re-running skips what already exists.

Three notes learned the hard way:

- Run the capture **twice** on a fresh queue. The first pass boots the backend, which drains the
  pg-boss triage queue; the second pass captures the settled state rather than tickets still in
  `AI_PROCESSING`.
- Capture **before** a full `npm test` run, or clean up afterwards. The user-management specs
  create throwaway `e2e-…@test.com` accounts that otherwise appear in `users.png`. They accumulate
  across runs, so if `users.png` has grown a wall of `E2E User …` rows, reset the test database:
  `docker exec dailyplate-helpdesk-postgres-test-1 psql -U helpdesk -d helpdesk_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`,
  then `prisma db push` and re-run every seed above.
- The demo agents come from `prisma/seedAgents.ts` and **nothing else recreates them**. `seed.ts`
  only creates the admin. Resetting the database without running `seedAgents.ts` leaves `users.png`
  and the dashboard's Online Agents list nearly empty.
