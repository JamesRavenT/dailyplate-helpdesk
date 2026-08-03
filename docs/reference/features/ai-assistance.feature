# Traceability: see docs/explanation/release-test-plan.md

@critical @ai
Feature: AI triage and agent assistance

  Incoming tickets are triaged automatically: straightforward questions are answered
  without a human, anything account-specific is escalated. Agents can also ask for help
  polishing a reply or summarising a long thread.

  The AI is a third-party service that can be slow, rate-limited, or simply wrong. What
  matters for release is not that the AI is clever — it is that the helpdesk stays usable
  and honest when the AI misbehaves.

  @critical @ai
  Scenario: A general question is answered without a human
    Given a customer asks a general question that the knowledge base already answers
    When the helpdesk triages the ticket
    Then the ticket is resolved automatically
    And the customer receives an answer
    And the ticket is marked as handled by AI

  @critical @ai @security
  Scenario: An account-specific problem is escalated to a human
    Given a customer reports a problem specific to their own account
    When the helpdesk triages the ticket
    Then the ticket is not answered automatically
    And it is escalated to a human agent
    # The costly failure is the opposite of a wrong answer: confidently resolving
    # something that needed a person.

  @ai @regression
  Scenario: An agent polishes a draft reply
    Given I am signed in as an agent with a draft reply written
    When I ask for the draft to be polished
    Then my draft is replaced with the improved wording
    And I can still edit it before sending

  @ai @regression
  Scenario: An agent summarises a long conversation
    Given I am signed in as an agent viewing a ticket with a long history
    When I ask for a summary
    Then a summary of the conversation is shown
    And I can regenerate it if it is not useful

  @ai @regression
  Scenario: An existing summary is shown without regenerating it
    Given a ticket already has a summary
    When I open that ticket
    Then the existing summary is shown immediately
    And I am offered the chance to regenerate it

  # --- Failure handling. R4: these are mocked at component level today but never
  # --- exercised against a real failing provider.

  @critical @ai @regression
  Scenario: A failed polish request does not destroy the agent's draft
    Given I am signed in as an agent with a draft reply written
    When I ask for the draft to be polished and the AI service fails
    Then I am told the polish could not be completed
    And my original draft is still in the reply box

  @critical @ai @regression
  Scenario: A failed summary is reported rather than shown as empty
    Given I am signed in as an agent viewing a ticket
    When I ask for a summary and the AI service fails
    Then I am told the summary could not be generated
    And no misleading empty summary is displayed

  @critical @ai @gap
  Scenario: A slow AI service does not block the agent
    Given I am signed in as an agent with a draft reply written
    When I ask for the draft to be polished and the AI service does not respond in time
    Then the request gives up within a bounded time
    And I am told it could not be completed
    And I can still send my reply myself

  @critical @ai @gap
  Scenario: A rate-limited AI service degrades gracefully
    Given the AI provider is refusing requests because of rate limits
    When a new customer email arrives
    Then the ticket is still created
    And it is escalated to a human rather than being silently dropped

  @critical @ai @gap
  Scenario: A ticket is never left stuck mid-triage
    Given a customer email has arrived and triage has begun
    When the AI service fails part-way through
    Then the ticket does not remain in a processing state indefinitely
    And an agent can still pick it up

  @ai @gap @manual
  Scenario: Agents are not misled about who wrote a reply
    Given a ticket was resolved automatically
    When an administrator reviews that ticket
    Then it is clearly attributed to the AI rather than to a person

  @ai @manual
  Scenario: Real provider behaviour is verified before release
    Given the opt-in real-provider suite is enabled
    When triage runs against the live AI provider
    Then a general question resolves automatically
    And an account-specific problem escalates
    # @manual: costs money on every run. Excluded from the default suite by design;
    # run deliberately before a release that touches triage.
