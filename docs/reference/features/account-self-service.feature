# Traceability: see docs/explanation/release-test-plan.md
# RISK R2 — every scenario below is currently unimplemented at every test layer, and the
# first one describes behaviour the service does NOT have today. See the release report.

@critical @security @gap @accepted-risk
Feature: Managing my own account

  # DECISION 2026-08-03: the missing current-password check is an accepted risk for the
  # demo release. These scenarios are specification only — excluded from every lane and
  # scheduled for no implementation work. Revisit before this handles real customer data.

  Any signed-in person can change their own name, email address and password. Because
  the email address is the sign-in identifier and the password is the only credential,
  these are the two most sensitive self-service actions in the product.

  Background:
    Given I am signed in as an agent

  @critical @security @gap
  Scenario: Changing my password requires proving I know the current one
    When I try to change my password
    Then I must supply my current password before the change is accepted
    # KNOWN DEFECT: PATCH /api/users/me accepts { password } alone and performs no
    # verification. Anyone with a live session — a borrowed laptop, a stolen cookie —
    # can silently take ownership of the account. This scenario FAILS by design today
    # and is the release blocker described in the report.

  @critical @security @gap
  Scenario: A wrong current password does not change my credentials
    When I try to change my password and supply the wrong current password
    Then my password is unchanged
    And I can still sign in with my original password

  @security @gap @api
  Scenario: A new password must meet the minimum length
    When I try to change my password to one shorter than eight characters
    Then the change is refused
    And I am told the password is too short

  @security @gap
  Scenario: Changing my password ends my other sessions
    Given I am also signed in on a second device
    When I successfully change my password
    Then the session on the second device is ended
    # Without this, a password change does not evict an attacker who already has a session.

  @security @gap @api
  Scenario: I cannot take an email address that belongs to someone else
    Given another user already uses "colleague@dailyplate.help"
    When I try to change my email address to "colleague@dailyplate.help"
    Then the change is refused as a conflict
    And I am told the email is already in use

  @regression @gap
  Scenario: Updating my display name is reflected across the helpdesk
    When I change my display name to "Raven T."
    Then my new name appears in the header
    And my new name appears wherever I am listed as an agent

  @security @gap @manual
  Scenario: Changing my email address changes how I sign in
    When I successfully change my email address
    Then I can sign in with the new address
    And I can no longer sign in with the old one
    # @manual for release 1: the product has no email-confirmation flow, so an accidental
    # or malicious change locks the account out with no self-recovery path. Flagged as a
    # known risk rather than automated, because the desired behaviour is a product decision.
