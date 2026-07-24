# Titling

Decide capability vs. special-case before naming anything. Every scenario title falls into exactly one of two shapes — pick the shape *first*, per scenario, before wording the title:

- **Proves the actor CAN do something** (critical path, alternative flows, any scenario whose entire point is "this succeeds") → title it `Can <capability>`. Examples: `Can create a purchase invoice for an existing supplier`, `Can create a purchase invoice for a new supplier`, `Can save a purchase invoice as a draft`, `Can post a purchase invoice`, `Can attach a document to a purchase invoice`, `Can split an invoice line`. This applies even though these are also "Create", "Save", "Complete" behavior families — the family name alone does NOT mean it should use the em-dash format below; check the shape, not the layer.
- **Shows a special case the system handles** (boundary, validation error, system/external error, blocked authorization, a recalculation, a lockdown after a state change) → title it `Family — distinguishing condition`. Lead with the behavior family sibling scenarios share (`Save`, `Delete row`, `Split line`); after the em-dash put only what differs. Examples: `Complete — blocked when the server returns an invalid invoice id`, `Split line — blocked when unallocated amount is zero`, `Split line — blocked on wrong-sign amount`, `Delete — hidden once invoice is Completed`.
- Quick test: if deleting this scenario would erase proof that a user *can* do something, it's `Can`. If deleting it would erase proof the system correctly handles an edge/blocked/recalculated situation, it's `Family — condition`.
- **A capability and its own failure mode never share a title shape, even though they're siblings in coverage.** Don't let the instinct to group siblings under one family prefix pull a happy-path scenario back into `Family — condition` — that instinct is right for two failure siblings (`Split line — blocked when unallocated amount is zero` / `Split line — blocked on wrong-sign amount` do share a prefix), but wrong between a capability and its failure (`Can post a purchase invoice` and `Complete — blocked when the invoice has no lines` describe the same feature and still take different shapes). Worked example — same feature area, both shapes present:
  ```gherkin
  Scenario: Can post a purchase invoice
    Given I have a draft invoice with one line totaling 450.00
    When I click Complete
    Then the invoice status changes to Completed

  Scenario: Complete — blocked when the invoice has no lines
    Given I have a draft invoice with no lines
    When I click Complete
    Then I see the validation message "An invoice must have at least one line before it can be completed"
    And the invoice status remains Draft
  ```
  Every critical-path or alt-flow scenario in your output must be individually checked against this test — do not default the whole feature to one shape.
