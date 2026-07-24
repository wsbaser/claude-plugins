---
name: wsbaser:bdd-scenarios
description: Produces optimized Gherkin scenarios covering critical paths, edge cases, and error handling. Use in planning phase before writing test code. Trigger: "write scenarios", "plan tests", "what to test", "give me gherkin", or analyze a branch for test coverage. Do NOT trigger for implementing test code, fixing tests, or Gherkin syntax questions.
---

# Test Scenario Planning Rules

## Coverage

Always cover these layers — apply judgment on depth based on feature risk and complexity:

| Layer | What to cover |
|-------|--------------|
| **Critical path** | Primary success flow(s) a user must be able to complete |
| **Alternative flows** | Valid variations: different roles, optional fields, different data combinations |
| **Boundary conditions** | Min/max values, empty states, exactly-at-limit inputs |
| **Validation errors** | Invalid data, missing required fields, wrong formats |
| **System/external errors** | Server failures, timeout, permission denied, missing prerequisites |
| **State transitions** | Before/after state, repeated actions, idempotency |
| **Authorization** | Wrong role, unauthenticated access (when auth is in scope) |

## Optimization

**One scenario per behavior, not per assertion.** Group every assertion that verifies one outcome; split when a single action causes independent outcomes (e.g. transforms data *and* sets a flag). If naming the outcome needs "and", it's two scenarios.

**Combine into one scenario:**
- Multiple field validations triggered by the same action (submit once, assert all error messages)
- Multiple UI elements that are always rendered together (one scenario, multiple `And` assertions)
- Sequential assertions on the result of a single user action

**Keep as separate scenarios:**
- Different user roles or permission levels
- Happy-path flows vs failure flows — never mix success and failure in one scenario
- Independent features that happen to share a screen

**Trim:**
- Don't write a scenario for every possible invalid value — pick representative boundary cases
- Don't repeat the same assertion across multiple scenarios when one scenario already covers it
- Omit scenarios where a real bug in that path would have no meaningful impact

## Gherkin Rules

- **First person when the actor is the one doing or observing.** When a step is the actor's own action or direct observation, write it as `I` (`When I click Save`, `Given I have added a row`, `Then I see a confirmation message`), never "the user". Drop the `I` framing when a step states an objective system or data fact instead — background data, a computed value, an error code (`Given the exchange rate is 1.2`, `Then the total equals 100.00`, not `Then I should see the total equal 100.00`). When a step needs a specific role, declare it in a dedicated `Given I am a <role>` step (e.g. `Given I am an accountant`); scenarios with no role-specific behavior need no such step.
- `Given` sets up pre-conditions (system state, authenticated user role, existing data)
- `When` describes one user action or event
- `Then` asserts a specific, observable outcome — use concrete values, not vague descriptions
- Use `Background` when 2+ scenarios share identical setup steps
- Use `Scenario Outline` + `Examples` table when the same flow runs with 3+ distinct data sets
- Order: critical path → alternative flows → edge/boundary cases → error handling
- **Titling: decide capability vs. special-case before naming anything.** Every scenario title falls into exactly one of two shapes — pick the shape *first*, per scenario, before wording the title:
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

## Severity Tagging

Tag every scenario with what its failure would mean in production — this lets whoever triages a failing run tell "drop everything" apart from "file it and move on" without re-deriving the impact from scratch. Judge each scenario on its own; don't default from its coverage layer. A critical-path scenario for a rarely-used report can matter less than a boundary case in something load-bearing, so ask the question fresh each time: *if this exact scenario's expected behavior broke in production, would there be a workaround, and how much would it take down?*

| Tag | If this scenario's behavior broke... |
|-----|---------------|
| `@severity-blocker` | ...a system or major part of it goes down. No workaround. Nobody works. |
| `@severity-critical` | ...this one feature is 100% dead. No workaround. Rest of the system is fine. |
| `@severity-high` | ...the feature is broken, but a workaround exists (manual step, slower path) — painful, still usable. |
| `@severity-medium` | ...the feature is only degraded — a partial malfunction or wrong output on an edge case. Workaround is easy, or the impact is narrow. |
| `@severity-low` | ...it's cosmetic only. No function is lost, no workaround needed. |

Place the tag directly above the `Scenario:`/`Scenario Outline:` line, alongside any other tags already there:

```gherkin
@severity-critical
Scenario: Can post a purchase invoice
  Given I have a draft invoice with one line totaling 450.00
  When I click Complete
  Then the invoice status changes to Completed
```

## Tables vs Prose

Prefer prose. When the input or outcome spans several rows, use a data table rather than stringing values into prose; add a `| note |` column when a row's result isn't self-evident.

## Naming & File Organization

A well-written scenario set is still a maintenance problem for whoever reads the suite next if it's poorly named or duplicated into the wrong file. Before finalizing:

- **Look at what's already there.** Glob for existing `.feature` files in the project. Their folder structure shows the established grouping convention (by module, by domain, by screen) — match it rather than inventing a new one. Check sibling files in the target folder: a new name must be tellable apart from them at a glance. Two files that both read as "Noun + Noun + Noun" force a reader to open both just to know which does what.
- **Name the file after the `Feature:` title**, compressed to the project's casing convention, verb-led rather than noun-piled — `RestrictInvoiceAccessByUser` reads as a sentence, `InvoiceAccessRestrictionOptions` reads as a label. Drop the folder's own name from the filename; restating it there is dead weight once the file already lives inside that folder.
- **Before splitting one draft into two files, check whether the two halves interact.** If any scenario needs to reference both parts to prove the behavior correct — one toggle's state changing what another does, a shared validation path — they're one coupled capability and belong in one file even though the feature title needs an "and". Only split when each half could change or ship without touching the other.

## Output

Gherkin block, followed by:
- **File**: the chosen relative path and filename, with a one-line reason (matches existing convention / new folder because none fits / merged into existing file `X` because scenarios overlap with it)
- **Coverage Notes** (3–6 bullets) explaining what was included, what was intentionally omitted, and which scenarios combine multiple validations
