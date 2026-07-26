# Testing strategy

The guiding rule: **write each test at the lowest layer that can cover it.** UI logic is tested
with fast component tests; end-to-end tests are reserved for behavior that genuinely needs the
real backend.

## Layer 1 — Component tests (Vitest + React Testing Library)

Test files sit next to the component as `<Name>.test.tsx`. Run from `frontend/`:

```bash
npm run test:component   # CI run (currently 124 tests)
npm run test:watch       # watch mode
```

**Covered here** (not E2E): rendering (headings, badges, columns, empty/error/loading states),
role/prop conditional visibility, form and button enabled/disabled logic, navigation callbacks,
and dropdowns seeded from fetched data.

**Patterns:** wrap in `QueryClientProvider` (`retry: false`); mock `axios` via a factory; mock
auth-dependent components and `authClient.useSession` for the role under test; wrap in
`MemoryRouter` for links. Global test setup clears `localStorage`/`sessionStorage` between tests
for isolation. The environment is `happy-dom`.

## Layer 2 — End-to-end (Playwright, in `e2e/`)

Used only for what mocks can't cover: the real API/backend, cross-service pipelines
(webhook → DB → REST → UI), real mutations, backend-enforced authorization, and navigation with
live DB-generated IDs.
Ticket integration tests use the real AI worker and shared agent-presence state, so the suite uses `retries: 2` to absorb that external nondeterminism; retried tests appear as "flaky" in the Playwright and Allure reports.

```bash
docker compose up postgres-test -d
cd e2e && npm test           # headless
cd e2e && npm run test:ui    # interactive
cd e2e && npm run report     # generate + open the Allure report
```

Test users are seeded by the E2E global setup: `admin@test.com` (ADMIN) and `agent@test.com`
(AGENT).

## Deployment smoke test

A separate, opt-in Playwright project targets a live deployed URL (`DEPLOYED_BASE_URL`) to
verify the Cloudflare → Render path after a deploy: `/health` returns JSON (not the SPA),
sign-in sets a cookie on the Cloudflare host, the follow-up request is authenticated, redirects
never expose the Render origin (`*.onrender.com`), and a deep link loads. It has no local
`webServer` and is run manually or in CI after deployment — the main suite stays on local
Vite/Postgres for speed.

> **Free-tier caveat:** a Render free instance spins down after ~15 minutes of inactivity and
> takes ~30–60s to wake. Hit the deployed `/health` once and wait for a `200` before running the
> smoke project, otherwise the first test can fail on a cold-start timeout rather than a real
> regression.

## Reporting

Playwright's HTML reporter is the quick, shareable artifact; **Allure** (`allure-playwright`)
produces the richer report used as portfolio evidence (`npm run report`). The Allure CLI needs a
Java runtime.
