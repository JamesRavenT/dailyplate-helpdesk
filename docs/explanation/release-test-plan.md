# Release test plan — risk-based BDD

Companion to the Gherkin specifications in [`docs/reference/features/`](../reference/features/).
This document explains *why* those scenarios exist, what already covers them, and what does not.

Reviewed by Codex (read-only) on 2026-08-03. Three live defects listed below were found during
that review, not by the original audit.

---

## Framework decision: executable Gherkin via playwright-bdd

The project runs four test runners:

| Runner | Scope | Location |
|---|---|---|
| `bun test` | Pure backend functions | `backend/src/**/*.test.ts` |
| Vitest + React Testing Library | Component behaviour | `frontend/src/**/*.test.tsx` |
| Playwright | Real browser + real API | `e2e/tests/` |
| playwright-bdd | Executable Gherkin | `docs/reference/features/` + `e2e/steps/` |

**Why playwright-bdd rather than Cucumber.js** (decision 2026-08-03). Cucumber.js would have
meant a genuinely separate runner, its own browser lifecycle, and a second reporting pipeline
alongside Allure. `playwright-bdd` is not a runner — it is a *code generator*. `bddgen` compiles
the feature files into Playwright specs under `e2e/.features-gen/`, which the existing Playwright
runner executes as an ordinary project. One browser lifecycle, one Allure pipeline, the existing
auth fixtures reused directly.

The feature files deliberately live in `docs/reference/features/`, not in `e2e/`. They are the
business-readable specification first and test input second; `featuresRoot` in
`playwright.config.ts` points there. `.features-gen/` is generated output — gitignored, never
edited by hand.

**Tag lanes.** Every lane excludes `@gap`, `@manual` and `@accepted-risk`, and the default
`tags` expression in `defineBddConfig` applies the same exclusion, so a specification-only
scenario cannot execute and report a false pass no matter how it is invoked.

```
npm run test:bdd            # everything implemented
npm run test:bdd:critical   # @critical lane
npm run test:bdd:smoke      # @smoke lane
npm run test:bdd:security   # @security lane
```

**Known limitation.** `missingSteps: 'skip-scenario'` is required, because only a handful of
scenarios have step definitions and generation would otherwise fail on all the rest. The cost:
a scenario whose step text later drifts from its definition **silently skips instead of
failing** — the exact failure mode that lets a suite lie. Confirmed against playwright-bdd
v9.2.0: there is no option combining `skip-scenario` with a generation-time count or warning.
Skips surface only as Playwright `fixme` results at run time. Until the `@gap` backlog is
closed and `missingSteps` can be tightened to `fail-on-gen`, **the skipped count in the run
output must be read, not ignored** — a sudden rise means drift, not progress.

Low-level technical checks are deliberately **not** written as Gherkin. Quote-stripping, HTML
entity decoding and sign-off normalisation are covered by `bun test` and stay there.

---

## Live defects found during this audit

These are not coverage gaps. They are defects in shipped code, confirmed by reading it.

### D1 — An agent's reply can be silently lost (Critical)

`createMessage` in `backend/src/controllers/tickets.ts` stores the message, updates the ticket,
responds `201`, and only *then* calls `sendReplyToCustomer` — after the response has already
been sent, with no await and failure handled by a logged `.catch`:

```ts
res.status(201).json(message)

sendReplyToCustomer({ ... })   // fire-and-forget; failure only reaches the server log
```

The agent's interface clears the draft and reports success. If Resend is down, rate-limited, or
misconfigured, **the customer receives nothing and nobody is told.** The same pattern applies to
AI-generated replies in `backend/src/lib/triage.ts`.

This is the worst failure mode in the product: it does not look like a failure.

### D2 — An inbound ticket can be created and then hidden from everyone (Critical)

`inboundEmail` commits the ticket with `status: 'AI_PROCESSING'` inside a transaction, then
enqueues the triage job outside it:

```ts
boss.send(PROCESS_QUEUE, { ... }).catch((err) => console.error('[boss] enqueue failed', ...))
```

If that enqueue fails, the ticket stays `AI_PROCESSING` forever. The ticket list then hides it:

```ts
where.status = status ?? { not: 'AI_PROCESSING' }   // deliberate, to prevent interference
```

So the customer's email is accepted, stored, and invisible to every human in the product.

This is reachable more easily than it looks: `backend/src/index.ts` starts listening and passes
its health check *before* `startBoss()` resolves, and a `startBoss()` failure is also only
logged. A backend that boots with a broken queue reports itself healthy and quietly swallows
every inbound email.

### D3 — Inbound email is not idempotent at message level (High)

`Ticket.email_thread_id` is `@unique`, but `Message` stores no provider message ID or event ID
and has no uniqueness constraint (`backend/prisma/schema.prisma`). The inbound gateway is
explicitly designed to retry on non-2xx. A retried *reply* therefore appends the same customer
message again. A retried *first* email hits a unique-key error rather than succeeding
idempotently.

---

## Risk register

Numbers are **identifiers, not ranking**. For priority, use the sequence in
"Recommended order of work" below.

| # | Risk | Sev | Status | Current coverage | Feature file |
|---|---|---|---|---|---|
| D1 | Agent reply silently undelivered | **Critical** | **Live defect** | None | `release-readiness` |
| D2 | Ticket stuck `AI_PROCESSING`, hidden from all | **Critical** | **Live defect** | None | `release-readiness` |
| R2 | Password changeable without proving identity | **Critical** | **Live defect** | None | `account-self-service` |
| R1 | Session outlives the user at the keyboard | **Critical** | Config fixed; stale rows may persist | Client hook only; server window untested | `authentication` |
| D3 | Inbound email not idempotent per message | **High** | **Live defect** | None | `release-readiness` |
| R12 | Third-party outage causes silent loss | **High** | Untested | None | `release-readiness` |
| R4 | AI provider fails, hangs, or rate-limits | **High** | Untested | Stub triage E2E; failure paths mocked only | `ai-assistance` |
| R6 | Article role boundaries unverified | **High** | Coverage gap | Guards present in code, never exercised | `authorization` |
| R3 | Knowledge base CRUD | Medium | Coverage gap | None | `knowledge-base` |
| R10 | Performance regression after bundle split | Medium | Coverage gap | None | `quality-attributes` |
| R5 | Dashboard chart from hand-written SQL | Medium | Coverage gap | Consumed via mocks in `Home.test.tsx`; SQL semantics unasserted | `dashboard-reporting` |
| R8 | Accessibility barriers | Medium | Coverage gap | None | `quality-attributes` |
| R11 | Deployment seam failures | Medium | Partial | Smoke suite exists but skipped by default | `release-readiness` |
| R13 | Sign-in brute force | Medium | Coverage gap | Rate limit configured, never verified | `authentication` |
| R9 | Unintended visual change | Low | Coverage gap | Screenshots captured, never compared | `quality-attributes` |
| R7 | Inbound email pipeline breaks | Low | Well covered | Unit + E2E through the real pipeline | `ticket-lifecycle` |

### R2 in detail

`PATCH /api/users/me` accepts `{ password }` with only a `min(8)` check and rewrites the
credential with no verification of the current password:

```ts
const hashed = await hashPassword(parsed.data.password)
await prisma.account.updateMany({ where: { userId: req.user!.id, providerId: 'credential' }, ... })
```

`verifyPassword` *is* used in the same controller for admin delete and lock, so the omission is
specific to self-service. Other sessions are not revoked on change. Exploit path: a live session
(borrowed laptop, stolen cookie) becomes independent credential ownership that outlives the
stolen session. An administrator can still recover the account, so "account takeover" is
accurate where "permanent ownership" would be overstated.

### R1 in detail

`expiresIn: 60 * 60` is correct in `backend/src/lib/auth.ts` today. The production incident
happened because Better Auth writes `expiresAt` at creation and a config change does not clamp
existing rows. **Adding a regression test does not remediate rows that already exist** — those
must be revoked separately. `CLAUDE.md` also carried a stale `expiresIn 7d / updateAge 1d` line,
corrected as part of this audit.

### Assessed and dismissed

- **SQL injection in the chart query** — `$queryRaw` is used as a tagged template with `${since}`
  bound as a parameter. Not a finding.
- **Email collision on profile update** — `updateOwnProfile` checks for an existing address and
  returns 409. Not a finding. (Changing the sign-in address with no confirmation step remains a
  product question, captured as `@manual`.)
- **Article route guards** — `requireAuth` / `requireAdmin` are correctly applied in
  `backend/src/routes/articles.ts`. This is a coverage gap, not evidence of a bypass.

---

## Traceability

| Feature file | Implemented by | Gaps |
|---|---|---|
| `authentication` | `e2e/tests/auth.spec.ts`, `frontend/src/hooks/useIdleLogout.test.ts`, `frontend/src/lib/http.test.ts` | server-side session window, rate limit |
| `authorization` | `e2e/tests/auth.spec.ts`, `e2e/tests/tickets.spec.ts`, `Tickets.test.tsx`, `TicketDetail.test.tsx`, `AppShell.test.tsx` | all article permissions |
| `ticket-lifecycle` | `e2e/tests/tickets.spec.ts`, `backend/src/controllers/webhooks.test.ts`, `backend/src/lib/text.test.ts` | cross-agent reply refusal |
| `user-management` | `e2e/tests/users.spec.ts`, `Users.test.tsx` | — |
| `ai-assistance` | `e2e/tests/tickets.spec.ts` (stub), `TicketDetail.test.tsx` (mocks), `e2e/tests/real-ai/` (opt-in) | timeout, rate limit, terminal state |
| `dashboard-reporting` | `Home.test.tsx` | chart SQL semantics |
| `knowledge-base` | — | **entire feature** |
| `account-self-service` | — | **entire feature** |
| `quality-attributes` | `AppShell.test.tsx` (mobile drawer) | a11y, visual, performance, viewports |
| `release-readiness` | `e2e/tests/internal.spec.ts`, `e2e/tests/smoke/deploy.smoke.spec.ts` (skipped by default) | D1, D2, D3, cache headers, edge blocking |

Note: `Login.tsx` has no component test, but sign-in *behaviour* is well covered by Playwright.
`Resources.tsx` has neither.

---

## Test data and safety

- E2E runs against an **isolated** Postgres on port `5434` (`docker compose up postgres-test`),
  separate from dev and production.
- `global-setup.ts` provisions the suite's own users; `playwright.config.ts` sets
  `reuseExistingServer: false` for the backend so a dev server pointed at the dev database can
  never satisfy the suite.
- The default suite forces `AI_PROVIDER=stub` and blanks any inherited `OPENAI_API_KEY`, so a
  normal run is network-free and costs nothing.
- **Nothing destructive runs against production.** The deploy smoke suite is read-only and
  opt-in via `DEPLOYED_BASE_URL`; the real-AI suite is opt-in via `RUN_REAL_OPENAI=1`.

### External trust boundary

Resend's Svix signature verification happens in the **n8n gateway**, not in this repository.
No test here can prove that gateway is configured correctly. `e2e/tests/internal.spec.ts`
verifies only the shared-token boundary on `/api/internal/*`. Treat gateway configuration as a
manual pre-release check.

---

## Recommended order of work

1. **D1** — await delivery, or record a delivery state on the message and surface failure to the agent.
2. **R2** — require the current password; revoke other sessions on success.
3. **D2** — fail the request if enqueue fails, or make the health check depend on `startBoss()`; add a recovery path for stranded `AI_PROCESSING` tickets.
4. **R1 remediation** — revoke existing long-window session rows, then add a server-side regression test.
5. **D3** — store a provider message ID on `Message` with a uniqueness constraint.
6. **R12 / R4** — outbound and AI failure paths, including pg-boss batch-retry semantics (`batchSize: 5` with non-idempotent side effects).
7. **R6 → R3** — article permissions, then article CRUD and the Resources page.
8. **R10** — a performance budget, while the bundle change is fresh.
9. **R5, R8, R9, R11, R13** — chart, accessibility, visual baselines, smoke wiring, rate limit.
