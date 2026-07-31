# Testing strategy

The guiding rule: **write each test at the lowest layer that can cover it.** UI logic is tested
with fast component tests; end-to-end tests are reserved for behavior that genuinely needs the
real backend.

## Layer 0 — Backend unit tests (`bun test`)

Pure backend functions with no database or network are tested with Bun's built-in runner — no extra
dependency. Test files sit next to the source as `<name>.test.ts`. Run from `backend/`:

```bash
bun test                 # currently 18 tests
```

**Covered here:** email quote stripping (`stripEmailQuotes`, `stripHtml`) and reply sign-off
normalization (`normalizeSignOff`). These are text transformations with many edge cases — wrapped
attributions, nested HTML quote containers, entity decoding, idempotency — and exercising them
through a browser and a database would be slower and prove less.

## Layer 1 — Component tests (Vitest + React Testing Library)

Test files sit next to the component as `<Name>.test.tsx`. Run from `frontend/`:

```bash
npm run test:component   # CI run (currently 131 tests)
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
Ticket integration tests run the real pg-boss worker with a deterministic, rule-based AI provider.
The default suite explicitly blanks `OPENAI_API_KEY`, so it neither depends on the network nor
incurs OpenAI cost. The worker tests cover both `AI_RESOLVED` and human-escalation paths.
The `customer email replies` group covers thread continuation against a real database: a reply
reopens a `CLOSED` ticket, reopens a `RESOLVED` one while keeping its assignee, and stores the new
text with the quoted history stripped. Status transitions are asserted through the API rather than
the UI, and each test awaits `waitForTicketSettled()` before changing status so the triage worker
cannot overwrite it mid-test.

```bash
docker compose up postgres-test -d
cd e2e && npm test           # headless
cd e2e && npm run test:ui    # interactive
cd e2e && npm run report     # generate + open the Allure report
```

Test users are seeded by the E2E global setup: `admin@test.com` (ADMIN) and `agent@test.com`
(AGENT).

### Real OpenAI validation (opt-in and paid)

The `real-openai` Playwright project makes live OpenAI requests and is excluded unless
`RUN_REAL_OPENAI=1` is set. Supply a real key only when intentionally validating model behavior:

```bash
# bash/zsh
RUN_REAL_OPENAI=1 OPENAI_API_KEY=sk-... npx playwright test --project=real-openai

# PowerShell
$env:RUN_REAL_OPENAI='1'; $env:OPENAI_API_KEY='sk-...'; npx playwright test --project=real-openai
```

This currently makes two paid triage calls: one general voucher question expected to be
auto-resolved and one account-access problem expected to be escalated. The normal ticket/UI
specs remain in the deterministic project because they validate the worker pipeline, not model
quality.

For test startup, Bun loads only the explicit `backend/.env.test.example` passed with
`--env-file`. In addition, `instrument.ts` skips its normal `dotenv.config()` backfill when
`NODE_ENV=test`, and Playwright overrides the child backend environment with
`AI_PROVIDER=stub` plus an empty `OPENAI_API_KEY`. This prevents a maintainer's
`backend/.env` or parent shell from silently supplying a paid key to the default suite.

## Deployment smoke test

A separate, opt-in Playwright project targets a live deployed URL (`DEPLOYED_BASE_URL`) to
verify the Cloudflare → Render path after a deploy: `/health` returns JSON (not the SPA),
sign-in sets a cookie on the Cloudflare host, the follow-up request is authenticated, redirects
never expose the Render origin (`*.onrender.com`), and a deep link loads. Playwright's
`webServer` configuration is global, so selecting only `deploy-smoke` still starts the local
backend and frontend even though the smoke requests target `DEPLOYED_BASE_URL`. The project is
run manually or in CI after deployment; its assertions target the deployed stack. Global setup
also still runs, so the local `postgres-test` service is required with the current configuration.

> **Free-tier caveat:** a Render free instance spins down after ~15 minutes of inactivity and
> takes ~30–60s to wake. Hit the deployed `/health` once and wait for a `200` before running the
> smoke project, otherwise the first test can fail on a cold-start timeout rather than a real
> regression.

## Reporting

Playwright's HTML reporter is the quick, shareable artifact; **Allure** (`allure-playwright`)
produces the richer report used as portfolio evidence (`npm run report`). The Allure CLI needs a
Java runtime.
