# Traceability: see docs/explanation/release-test-plan.md
# Deployment verification and behaviour when a third party fails.

@critical @deployment
Feature: The deployed helpdesk behaves like the real thing

  The helpdesk is assembled from four services: a Cloudflare edge that serves the app and
  proxies the API, a backend on Render, a database on Neon, and an automation workflow that
  receives inbound customer email. Most release incidents come from the seams between them,
  not from the code inside any one of them.

  @critical @deployment @smoke
  Scenario: The deployed backend is reachable through the public address
    Given the helpdesk has been deployed
    When I check the service health endpoint on the public address
    Then it reports the backend is healthy
    And it does not return the web application by mistake

  @critical @deployment @smoke
  Scenario: Deep links into the application work
    Given the helpdesk has been deployed
    When I open a ticket address directly in a fresh browser
    Then the application loads and takes me to sign in
    And I do not receive a not-found error

  @critical @deployment @security
  Scenario: The public address never redirects to the backend host
    Given the helpdesk has been deployed
    When the service issues a redirect during sign-in
    Then the redirect stays on the public address
    And it never exposes the underlying hosting address
    # Leaking the origin host would break session cookies and bypass the edge.

  @critical @deployment @security
  Scenario: Internal-only endpoints are not reachable from the internet
    Given the helpdesk has been deployed
    When I request an internal endpoint through the public address
    Then it is not found
    # Internal routes are deliberately blocked at the edge; the email automation
    # reaches them by the private hosting address instead.

  @critical @deployment @security @api
  Scenario: Internal endpoints require the shared secret
    When the email automation calls an internal endpoint without the agreed token
    Then the request is rejected
    And no ticket is created

  @deployment @perf
  Scenario: Versioned assets are cached permanently by browsers
    Given the helpdesk has been deployed
    When I inspect how the application's versioned files are cached
    Then browsers are told they may keep them indefinitely
    And the application's entry page is not cached that way
    # Guards the immutable-caching change. Verifiable only against a real deployment.

  @deployment @manual
  Scenario: A new deployment reaches visitors promptly
    Given a new version has been deployed
    When an existing visitor reloads the helpdesk
    Then they receive the new version rather than a stale cached one

  @critical @deployment @manual
  Scenario: Database changes are applied before the service accepts traffic
    Given a release contains a database change
    When the service starts up
    Then the change is applied before it reports itself healthy

  @deployment @manual @security
  Scenario: Seeding is a deliberate act, not a side effect of restarting
    Given the service restarts after being idle
    Then no seed data is written
    And existing article content is left exactly as it is
    # Seeding re-upserts the default article set, so an accidental run would silently
    # revert edited articles.

  # --- Third-party failure. R12 in the risk register. None of this is covered today,
  # --- and the first three describe behaviour the product does NOT have. See D1/D2/D3
  # --- in docs/explanation/release-test-plan.md.

  @integration @gap @critical
  Scenario: Losing the AI provider does not stop tickets arriving
    Given the AI provider is unavailable
    When a customer sends an email
    Then a ticket is still created
    And it is escalated to a human agent

  @critical @integration @gap @known-defect
  Scenario: An agent is told when their reply could not be delivered
    Given the outbound email service is unavailable
    And I am signed in as an agent
    When I send a reply to a customer
    Then my reply is recorded on the ticket
    And I am told it could not be delivered
    # KNOWN DEFECT (D1): the service responds 201 and the interface clears the draft
    # BEFORE delivery is attempted. Delivery failure is only written to the server log.
    # The agent believes the customer was answered when nothing was sent. This scenario
    # FAILS by design today and is a release blocker.

  @critical @integration @gap @known-defect
  Scenario: A ticket is never accepted and then hidden from everyone
    Given the triage queue is unavailable
    When a customer sends an email
    Then either the message is refused so the sender retries, or the ticket is visible to an administrator
    # KNOWN DEFECT (D2): the ticket is committed as AI_PROCESSING and the enqueue failure
    # is only logged. Administrators are deliberately not shown AI_PROCESSING tickets, so
    # the customer's email is accepted, stored, and invisible to every human.

  @critical @integration @gap @known-defect @deployment
  Scenario: A backend that cannot start its queue does not report itself healthy
    Given the triage queue cannot be started
    When the backend starts up
    Then it does not report itself as healthy
    # KNOWN DEFECT (D2): the server begins listening and passes its health check before
    # queue startup resolves, and a startup failure is only logged. A backend with a
    # broken queue silently swallows every inbound email.

  @integration @gap @critical
  Scenario: A brief database interruption surfaces as an error, not corruption
    Given the database is briefly unreachable
    When I try to open the ticket list
    Then I am shown an error and invited to retry
    And no partial or invented data is displayed

  @integration @gap @critical @known-defect
  Scenario: A redelivered customer email does not duplicate the conversation
    Given the email automation retries after a timeout
    When the same customer email is delivered twice
    Then only one ticket exists for it
    And the customer's message appears only once
    And the second delivery is acknowledged as success
    # KNOWN DEFECT (D3): messages carry no provider message ID and no uniqueness
    # constraint, so a retried reply appends a duplicate. A retried first email fails on
    # the ticket's unique thread ID instead of succeeding idempotently.

  @integration @gap
  Scenario: Retrying a batch of queued work does not duplicate its effects
    Given several tickets are queued for triage together
    When one of them fails and the batch is retried
    Then already-processed tickets are not answered twice
    # Triage runs with batchSize 5 over non-idempotent side effects (sending email,
    # writing messages). Batch-retry semantics are unverified.

  @integration @gap @manual
  Scenario: The inbound email gateway rejects forged messages
    When a message arrives with an invalid signature
    Then it is rejected
    And no ticket is created
