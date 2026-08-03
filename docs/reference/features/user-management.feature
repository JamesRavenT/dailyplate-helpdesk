# Traceability: see docs/explanation/release-test-plan.md

@critical @security
Feature: Managing helpdesk accounts

  There is no self-registration. Administrators create every account, and can lock or
  remove one when someone leaves. Destructive actions are deliberately gated behind the
  administrator re-entering their own password.

  Background:
    Given I am signed in as an administrator

  @critical @smoke
  Scenario: An administrator creates an agent account
    When I create an agent with a name, email and password
    Then the new agent appears in the account list
    And that agent can sign in

  @regression
  Scenario: An administrator corrects an agent's details
    Given an agent account exists
    When I change that agent's name and email
    Then the updated details are shown in the account list

  @critical @security
  Scenario: Locking an account revokes access
    Given an active agent account exists
    When I lock that account
    Then the account is shown as locked
    And that agent can no longer sign in

  @critical @security
  Scenario: Unlocking an account restores access
    Given a locked agent account exists
    When I unlock that account
    Then the account is shown as active
    And that agent can sign in again

  @critical @security
  Scenario: Deleting an account requires the administrator's own password
    Given an agent account exists
    When I delete that account and confirm with my own password
    Then the account is removed from the list

  @critical @security
  Scenario: A wrong confirmation password does not delete the account
    Given an agent account exists
    When I attempt to delete it and supply an incorrect password
    Then I am told the password was incorrect
    And the account still exists
    # This message must surface in the dialog itself. CLAUDE.md warns against a blanket
    # 401 handler, which would sign the administrator out instead of showing the error.

  @security @regression
  Scenario: A wrong confirmation password does not sign the administrator out
    Given an agent account exists
    When I attempt to delete it and supply an incorrect password
    Then I remain signed in on the same page

  @regression
  Scenario: An administrator sees who is currently available
    Given agents have set their availability
    When I view the account list
    Then each agent's availability is shown
    And administrators themselves show no availability
