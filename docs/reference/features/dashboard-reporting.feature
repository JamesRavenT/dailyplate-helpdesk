# Traceability: see docs/explanation/release-test-plan.md

@regression
Feature: Dashboards and reporting

  The dashboard is the first thing everyone sees after signing in. Administrators get a
  whole-service view; agents see only their own workload. The numbers are read-only, so
  the risk is not corruption but misinformation — a wrong figure quietly misleads.

  @smoke @critical
  Scenario: An administrator sees the service-wide dashboard
    Given I am signed in as an administrator
    When I open my dashboard
    Then I am greeted by name
    And I see the service-wide ticket statistics
    And I see which agents are currently online

  @smoke @critical
  Scenario: An agent sees only their own workload
    Given I am signed in as an agent
    When I open my dashboard
    Then I see statistics for my own tickets
    And I do not see the list of online agents

  @regression
  Scenario: The dashboard shows progress while data loads
    Given I am signed in
    When my dashboard is still loading
    Then I see placeholders rather than an empty page

  @regression
  Scenario: An agent with no work sees an explanation, not a blank panel
    Given I am signed in as an agent with no assigned tickets
    When I open my dashboard
    Then I am told there are no tickets waiting for me

  @regression
  Scenario: Selecting a ticket from the dashboard opens it
    Given I am signed in and my dashboard shows recent tickets
    When I select one
    Then I am taken to that ticket

  # --- The activity chart. R5: served by hand-written SQL with no coverage at any layer.

  @gap @api @regression
  Scenario: The activity chart covers the last thirty days
    Given I am signed in as an administrator
    When my dashboard loads the activity chart
    Then it contains one entry per day for the last thirty days
    And days with no activity are reported as zero rather than omitted

  @gap @api @regression
  Scenario Outline: Each audience gets the right chart series
    Given I am signed in as "<role>"
    When my dashboard loads the activity chart
    Then it contains <series> series

    Examples:
      | role          | series |
      | administrator | four   |
      | agent         | two    |

  @gap @api @security
  Scenario: An agent's chart never includes other agents' work
    Given other agents have resolved tickets in the last thirty days
    And I am signed in as an agent
    When my dashboard loads the activity chart
    Then it reflects only my own tickets

  @gap @api @regression
  Scenario: Critical tickets are counted by priority
    Given there are tickets of mixed priority
    When the dashboard reports the number of critical tickets
    Then it counts tickets of high priority
    # Deliberate product decision recorded in CLAUDE.md: severity is sparsely populated
    # and must not be used for this figure. A silent regression here is plausible.
