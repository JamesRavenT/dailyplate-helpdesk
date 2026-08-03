# Traceability: see docs/explanation/release-test-plan.md
# RISK R3 — this entire feature has no automated coverage at any layer today.

@critical @gap
Feature: The knowledge base

  Support articles describe the standard answers to common questions. Agents read them
  while working a ticket, and the AI draws on them when deciding whether a question can
  be answered without a human. Wrong or missing articles therefore affect both humans
  and automated triage.

  @critical @gap @smoke
  Scenario: An agent reads the published articles
    Given I am signed in as an agent
    When I open the resources page
    Then I see the list of published articles
    And I can open one and read its full content

  @gap @regression
  Scenario: Articles can be searched
    Given there are several published articles
    And I am signed in as an agent
    When I search for a phrase that appears in one of them
    Then only the matching articles are listed

  @gap @regression
  Scenario: An empty knowledge base is explained rather than blank
    Given there are no published articles
    And I am signed in as an agent
    When I open the resources page
    Then I am told there are no articles yet

  @critical @gap
  Scenario: An administrator publishes a new article
    Given I am signed in as an administrator
    When I create an article with a title, category and content
    Then it appears in the article list
    And agents can read it

  @gap @regression
  Scenario: An administrator corrects an article
    Given a published article exists
    And I am signed in as an administrator
    When I change its content and save
    Then the updated content is shown to agents

  @critical @gap @security
  Scenario: An administrator removes an article
    Given a published article exists
    And I am signed in as an administrator
    When I delete it
    Then it no longer appears in the article list

  @gap @api @regression
  Scenario: A malformed article is rejected
    Given I am signed in as an administrator
    When I submit an article without a title
    Then the request is refused
    And I am told what was wrong with it

  @gap @regression
  Scenario: Requesting an article that does not exist is handled cleanly
    Given I am signed in as an agent
    When I open an article that has been deleted
    Then I am told it could not be found
    And the helpdesk does not error

  @gap @manual @ai
  Scenario: Article changes reach automated triage
    Given an administrator has published a new article covering a common question
    When a customer asks that question by email
    Then triage can resolve it using the new article
    # @manual: couples the knowledge base to the AI provider. Worth a deliberate check
    # after any change to article content or seeding, because seeding re-upserts the
    # default article set on every run.
