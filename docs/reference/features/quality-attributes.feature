# Traceability: see docs/explanation/release-test-plan.md
# Accessibility, responsive layout, visual stability and performance.
# These are user-visible promises, so they are written as behaviour. The measurement
# technique behind each one is a technical detail and stays out of the Gherkin.

@regression
Feature: The helpdesk is usable, stable and fast

  Agents work in this tool all day, often on a laptop and sometimes on a phone between
  other tasks. It has to be operable by keyboard, readable, not jump around while
  loading, and not make anyone wait.

  # --- Accessibility. R8: no automated coverage exists today.

  @a11y @gap @critical
  Scenario Outline: Every main screen is free of blocking accessibility faults
    Given I am signed in
    When I open the "<screen>" screen
    Then it has no critical or serious accessibility violations

    Examples:
      | screen        |
      | sign in       |
      | dashboard     |
      | ticket list   |
      | ticket detail |
      | resources     |
      | user accounts |

  @a11y @gap @critical
  Scenario: An agent can work a ticket without a mouse
    Given I am signed in as an agent
    When I navigate a ticket using only the keyboard
    Then I can reach the reply box, write a reply and send it
    And the element I am on is always visibly focused

  @a11y @gap
  Scenario: Dialogs trap and restore focus
    Given I am signed in as an administrator
    When I open a confirmation dialog
    Then focus moves into the dialog
    And pressing Escape closes it and returns focus to where I was

  @a11y @gap
  Scenario: Status is conveyed by more than colour
    Given I am viewing the ticket list
    Then each ticket's status is readable as text, not colour alone

  @a11y @gap @manual
  Scenario: The helpdesk is usable with a screen reader
    Given I am using a screen reader
    When I open a ticket and send a reply
    Then every control is announced with a meaningful name
    And the result of sending is announced
    # @manual: automated checks cannot judge whether an announcement is meaningful.

  # --- Responsive layout. Partially covered: the mobile drawer has component tests.

  @responsive @regression
  Scenario: The navigation collapses on a small screen
    Given I am signed in on a phone-sized screen
    When I open the main navigation
    Then it appears as a drawer
    And I can close it again

  @responsive @gap
  Scenario Outline: Core screens are usable at common sizes
    Given I am signed in on a "<device>" screen
    When I open the ticket list
    Then no content is cut off or overlapping
    And the page does not scroll sideways

    Examples:
      | device  |
      | phone   |
      | tablet  |
      | laptop  |

  # --- Visual stability. R9: screenshots are captured today but never compared.

  @visual @gap
  Scenario Outline: Screens do not change appearance unintentionally
    Given I am signed in
    When I open the "<screen>" screen
    Then its appearance matches the approved baseline

    Examples:
      | screen        |
      | dashboard     |
      | ticket list   |
      | ticket detail |

  @visual @gap
  Scenario: Content does not jump around as it loads
    Given I am signed in
    When my dashboard finishes loading
    Then content has not shifted position significantly while loading

  # --- Performance. R10: no budget is enforced, and the bundle was just restructured.

  @perf @gap @critical
  Scenario: The sign-in page is quick to load for a first-time visitor
    Given I have never visited the helpdesk before
    When I open the sign-in page
    Then it becomes usable well within the agreed budget

  @perf @gap @critical
  Scenario: A returning visitor re-uses cached assets
    Given I have visited the helpdesk before
    When I return to it
    Then the previously downloaded assets are served from my browser's cache
    And they are not re-fetched from the network
    # Directly guards the immutable-caching change: a regression here silently restores
    # a full revalidation round trip on every single page load.

  @perf @gap
  Scenario: The initial download stays within budget
    When the sign-in page loads
    Then the amount of code downloaded before it is usable stays within the agreed budget

  @perf @gap @manual
  Scenario: A cold backend still serves the first visitor
    Given the backend has been idle long enough to shut down
    When someone opens the helpdesk
    Then the page itself appears immediately
    And the first data request completes once the backend has restarted
    # @manual: requires a genuinely idle free-tier instance; not automatable in CI.
