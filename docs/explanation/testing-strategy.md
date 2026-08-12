# Testing strategy

The guiding rule: **write each test at the lowest layer that can cover it.** UI logic is tested
with fast component tests; end-to-end tests are reserved for behavior that genuinely needs the
real backend.

## Layer 0 — Backend unit tests (`bun test`)

Pure backend functions with no database or network are tested with Bun's built-in runner — no extra
dependency. Test files sit next to the source as `<name>.test.ts`. Run from `backend/`:

```bash
bun test                 # currently 36 tests
```

**Covered here:** email quote stripping (`stripEmailQuotes`, `stripHtml`), reply sign-off
normalization (`normalizeSignOff`), inbound source-id derivation, the pg-boss pool configuration
and its production guard, the triage worker's health derivation, and its retry-safety wrapper.
The text transformations have many edge cases — wrapped attributions, nested HTML quote
containers, entity decoding, idempotency — and exercising them through a browser and a database
would be slower and prove less. The worker logic is pure by construction: `deriveBossStatus` takes
a snapshot struct and `processJobWithRetrySafety` takes injected operations, so both are tested
without a queue or a database.

## Layer 1 — Component tests (Vitest + React Testing Library)

Test files sit next to the component as `<Name>.test.tsx`. Run from `frontend/`:

```bash
npm run test:component   # CI run (currently 186 tests)
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
never expose the Render origin (`*.onrender.com`), and a deep link loads. The project is run
manually or by the `deploy-smoke` workflow after a deploy; its assertions target the deployed
stack.

Set **`SMOKE_ONLY=1`** for these runs. Playwright applies `webServer` and `globalSetup` to every
project, so without it a smoke run boots a local backend and frontend that no test contacts, and
`global-setup.ts` tries to push the Prisma schema into a `postgres-test` database that a
deploy-verification job has no reason to run. `SMOKE_ONLY=1` empties both, which is what lets CI
skip the Postgres service and the backend, Prisma and frontend installs entirely. It is guarded:
without `DEPLOYED_BASE_URL` the config throws rather than silently sending every request to a
`localhost` that isn't listening.

```bash
# bash/zsh
SMOKE_ONLY=1 DEPLOYED_BASE_URL=https://dailyplate.help npx playwright test --project=deploy-smoke

# PowerShell
$env:SMOKE_ONLY='1'; $env:DEPLOYED_BASE_URL='https://dailyplate.help'; npx playwright test --project=deploy-smoke
```

The access gate needs no key here — `tests/fixtures/accessGate.ts` intercepts the verifier call
and seeds local storage. The sign-in test skips itself unless `SMOKE_ADMIN_EMAIL` and
`SMOKE_ADMIN_PASSWORD` are set, so a run without them reports 3 passed, 1 skipped.

> **Free-tier caveat:** a Render free instance spins down after ~15 minutes of inactivity and
> takes ~30–60s to wake. Hit the deployed `/health` once and wait for a `200` before running the
> smoke project, otherwise the first test can fail on a cold-start timeout rather than a real
> regression.

## Continuous integration

`.github/workflows/ci.yml` runs the layers above on every pull request and every push to `main`.
The split follows the same principle as the test layering — put each check where it is cheapest.

| Job | Runs on | Typical duration |
|---|---|---|
| Backend unit tests + `tsc --noEmit` | every PR | ~20s |
| Component tests + production build | every PR | ~45s |
| Migrations applied to an empty database, then a drift check | every PR | ~25s |
| Full Playwright suite (chromium + bdd) | push to `main`, or a PR labelled `run-e2e` | ~3m |

**Why e2e doesn't gate every PR.** It downloads a browser, provisions Postgres, boots two dev
servers and runs serially (`workers: 1`), which is minutes rather than seconds. Running it on
`main` catches regressions before they can reach a release, while PR feedback stays under a
minute. Label a PR `run-e2e` when the change touches the webhook, worker or auth paths where a
mock cannot tell you the truth.

**The migrations job** applies `prisma/migrations` to an empty database and then runs
`prisma migrate diff --from-config-datasource --to-schema`. A non-empty diff means `schema.prisma`
was edited without generating a migration — cheap to catch here, expensive to discover when a
deploy runs `migrate deploy` against production.

**Ordering constraint.** Playwright starts `webServer` *before* `globalSetup`, so CI must create
the schema itself before invoking Playwright: on an empty database the backend boots with no
tables, and because `startBoss()` runs before `app.listen()`, `ensureAiUser()` exits the process
and takes the run down. A development database already has the tables, so this only appears on a
genuinely fresh database.

Deploys are not driven from Actions — Cloudflare Workers Builds and Render both build from `main`
directly. `deploy-smoke.yml` waits for the deployed `/health` to return 200, then runs the smoke
project described above. See [how-to/deploy.md](../how-to/deploy.md#7-continuous-integration-and-deploy-verification)
for the repository variables and secrets it needs.

## Reporting

Playwright's HTML reporter is the quick, shareable artifact; **Allure** (`allure-playwright`)
produces the richer report used as portfolio evidence (`npm run report`). The Allure CLI needs a
Java runtime.
