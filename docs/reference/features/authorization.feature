# Traceability: see docs/explanation/release-test-plan.md

@critical @security
Feature: Who can see and do what

  The helpdesk has two roles. Administrators manage people and oversee every ticket.
  Agents work only the tickets assigned to them. Hiding a control in the interface is a
  courtesy, not a security boundary — the server must refuse the action regardless.

  @critical @smoke
  Scenario: An administrator can reach user management
    Given I am signed in as an administrator
    When I open the user management page
    Then I see the list of people with helpdesk accounts

  @critical @security
  Scenario: An agent cannot reach user management
    Given I am signed in as an agent
    When I try to open the user management page
    Then I am returned to my dashboard
    And I never see anyone else's account details

  @security @api @critical
  Scenario: An agent calling the user management service directly is refused
    Given I am signed in as an agent
    When I request the list of helpdesk accounts directly from the service
    Then the request is refused as forbidden
    # The screen being hidden is not the control. The server is.

  @regression
  Scenario: Navigation reflects my role
    Given I am signed in as an agent
    When I look at the main navigation
    Then I am not offered a link to user management

  @critical @security
  Scenario: An agent only sees tickets assigned to them
    Given there is an unassigned ticket in the queue
    And I am signed in as an agent
    When I view the ticket list
    Then that ticket is not shown to me

  @critical @security
  Scenario: A ticket becomes visible once assigned to me
    Given there is an unassigned ticket in the queue
    And I am signed in as an agent
    When an administrator assigns that ticket to me
    And I refresh my ticket list
    Then I can see the ticket

  @security @regression
  Scenario: Agents cannot filter to statuses they do not own
    Given I am signed in as an agent
    When I open the status filter on the ticket list
    Then I may filter only by Open and In Progress

  @regression
  Scenario Outline: Role-specific controls on a ticket
    Given I am signed in as "<role>"
    When I open a ticket
    Then the "<control>" control is "<visibility>"

    Examples:
      | role          | control            | visibility |
      | administrator | assign agent       | visible    |
      | administrator | reply to customer  | hidden     |
      | administrator | polish reply       | hidden     |
      | agent         | assign agent       | hidden     |
      | agent         | reply to customer  | visible    |
      | agent         | polish reply       | visible    |

  # --- Knowledge base permissions. R3: currently untested at every layer.

  @security @gap @critical
  Scenario: Any signed-in user can read the knowledge base
    Given I am signed in as an agent
    When I open the resources page
    Then I can read the published articles

  @security @api @critical
  Scenario: An agent cannot create a knowledge base article
    Given I am signed in as an agent
    When I attempt to create an article directly through the service
    Then the request is refused as forbidden

  @security @api @critical
  Scenario Outline: Only administrators may change the knowledge base
    Given I am signed in as an agent
    When I attempt to "<action>" an article directly through the service
    Then the request is refused as forbidden

    Examples:
      | action |
      | update |
      | delete |
