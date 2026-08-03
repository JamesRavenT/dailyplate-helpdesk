# Traceability: see docs/explanation/release-test-plan.md

@critical
Feature: From customer email to resolved ticket

  A customer emails support. The message becomes a ticket, is triaged, may be answered
  automatically, and otherwise reaches a human agent. This is the product's core promise
  and the path most likely to embarrass us if it breaks.

  @critical @smoke
  Scenario: A customer email becomes a ticket
    Given a customer sends an email to the support address
    When the helpdesk receives it
    Then a ticket is created with the customer's name, email and subject
    And the ticket appears in the administrator's ticket list

  @critical @regression
  Scenario: A reply to an existing ticket joins the same conversation
    Given a customer already has an open ticket
    When that customer replies to the ticket's email thread
    Then the reply is added to the existing conversation
    And no second ticket is created

  @critical @regression
  Scenario: Only the customer's new words are kept from a reply
    Given a customer has an open ticket
    When the customer replies with their email client quoting the whole previous message
    Then only the newly written text is stored on the ticket
    And the quoted history is discarded

  @critical @regression
  Scenario: A reply reopens a closed ticket
    Given a customer's ticket has been closed
    When the customer replies to that thread
    Then the ticket is reopened

  @critical @regression
  Scenario: Reopening a resolved ticket keeps its agent
    Given a ticket was resolved by an agent
    When the customer replies to that thread
    Then the ticket is reopened
    And it remains assigned to the same agent

  @critical
  Scenario: An administrator assigns a ticket to an agent
    Given there is an unassigned ticket
    And I am signed in as an administrator
    When I assign it to an available agent
    Then the ticket shows that agent as its owner
    And the agent can now see the ticket

  @critical
  Scenario: An agent replies to the customer
    Given I am signed in as an agent with an assigned ticket
    When I write and send a reply
    Then my reply appears in the conversation
    And the customer receives it by email

  @regression
  Scenario: An agent changes the state of a ticket
    Given I am signed in as an agent with an assigned ticket
    When I change its status and save
    Then the ticket header reflects the new status

  @regression
  Scenario: Nothing is saved until something actually changes
    Given I am signed in as an agent viewing a ticket
    When I have not changed the status, priority or category
    Then the save control is unavailable
    And it becomes available as soon as I change any of them

  @regression
  Scenario: Searching narrows the ticket list
    Given there are tickets from several customers
    And I am signed in as an administrator
    When I search for a customer's name
    Then only that customer's tickets are listed

  @regression
  Scenario: Opening a ticket from the list shows the right ticket
    Given I am signed in as an administrator viewing the ticket list
    When I select a ticket by its subject
    Then I am taken to that ticket's detail page

  @security @regression
  Scenario: An agent cannot reply to a ticket that is not theirs
    Given a ticket is assigned to a different agent
    And I am signed in as an agent
    When I attempt to reply to that ticket directly through the service
    Then the request is refused

  # --- Agent presence. Drives routing: a ticket must never be assigned to a ghost.

  @regression
  Scenario: An agent who stops working is marked offline
    Given I am signed in as an agent and marked available
    When I close the helpdesk without signing out
    And more than two minutes pass
    Then I am shown as offline to administrators

  @regression
  Scenario: Signing out marks me offline immediately
    Given I am signed in as an agent and marked available
    When I sign out
    Then I am shown as offline straight away
