# Traceability: see docs/explanation/release-test-plan.md
# Layer key: [E2E] Playwright · [CMP] Vitest+RTL · [UNIT] bun test · [GAP] not yet implemented

@critical @security
Feature: Signing in and staying signed in

  Agents and admins are the only people who can reach the helpdesk. There is no public
  sign-up: accounts are provisioned by an administrator. A session must not outlive the
  person sitting at the machine.

  Background:
    Given the helpdesk is available

  @smoke @critical
  Scenario: An agent signs in with valid credentials
    Given I am a registered agent with an active account
    When I sign in with my correct email and password
    Then I am taken to my dashboard
    And I see my own name in the header

  @security @regression
  Scenario: Sign-in is refused with the wrong password
    Given I am a registered agent with an active account
    When I sign in with an incorrect password
    Then I remain on the sign-in page
    And I see a message that my credentials were not accepted
    And the message does not reveal whether the email exists

  @security @critical
  Scenario: A locked account cannot sign in
    Given my account has been locked by an administrator
    When I sign in with my correct email and password
    Then I am refused access
    And I see a message that my account is locked

  @security @critical
  Scenario: A signed-in user whose account is locked loses access immediately
    Given I am signed in as an agent
    When an administrator locks my account
    And I next interact with the helpdesk
    Then I am signed out and returned to the sign-in page

  @security @regression
  Scenario: Public sign-up is not available
    When I attempt to register a new account myself
    Then the helpdesk refuses to create it

  # --- Session lifetime. R1 in the risk register: this shipped broken to production,
  # --- where sessions survived 7 days instead of 1 hour. Highest-priority regression.

  @critical @security @regression
  Scenario: An idle session ends after one hour
    Given I am signed in as an agent
    When I do nothing at all for one hour
    Then I am signed out
    And returning to the helpdesk requires me to sign in again

  @critical @security
  Scenario: I am warned before an idle session ends
    Given I am signed in as an agent
    When I have been idle for fifty-five minutes
    Then I am warned that my session is about to end
    And I am offered the chance to stay signed in

  @critical @security @gap
  Scenario: Choosing to stay signed in extends the session
    Given I have been warned that my session is about to end
    When I choose to stay signed in
    Then the warning disappears
    And I remain signed in for a further hour

  @critical @security @regression @gap
  Scenario: A session left open in a closed browser still expires
    Given I am signed in as an agent
    And I close the browser without signing out
    When I return to the helpdesk after more than one hour
    Then I am asked to sign in again
    # The only defence here is the server-side window. The idle hook cannot run in a
    # closed browser, and nothing currently asserts the server's session lifetime.

  @critical @security @regression @gap
  Scenario: Continuous background activity does not keep a session alive on its own
    Given I am signed in as an agent
    And my dashboard is polling for new tickets in the background
    When I perform no real interaction for one hour
    Then I am signed out
    # Guards the deliberate design in CLAUDE.md: requireAuth must not forward Better Auth's
    # refreshed cookie, or the dashboard's 15-30s poll would keep sessions alive forever.

  @regression
  Scenario: Signing in again while already signed in returns me to my dashboard
    Given I am signed in as an agent
    When I navigate to the sign-in page
    Then I am redirected to my dashboard

  @regression
  Scenario: A signed-in session survives a page refresh
    Given I am signed in as an agent
    When I reload the page
    Then I am still signed in

  @security @api @manual
  Scenario: Repeated failed sign-ins are rate limited
    Given I am not signed in
    When I submit more than twenty failed sign-in attempts within fifteen minutes
    Then further attempts are rejected until the window passes
    # @manual: the production limit is 20/15min. Automating this in the default suite would
    # either slow it down or require lowering the limit under test, which weakens the check.
