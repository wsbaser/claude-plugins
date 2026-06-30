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

- **First person, one actor.** Write every user step as `I` (`When I click Save`, `Given I have added a row`), never "the user". When a step needs a specific role, declare it in a dedicated `Given I am a <role>` step (e.g. `Given I am an accountant`); scenarios with no role-specific behavior need no such step.
- `Given` sets up pre-conditions (system state, authenticated user role, existing data)
- `When` describes one user action or event
- `Then` asserts a specific, observable outcome — use concrete values, not vague descriptions
- Use `Background` when 2+ scenarios share identical setup steps
- Use `Scenario Outline` + `Examples` table when the same flow runs with 3+ distinct data sets
- Order: critical path → alternative flows → edge/boundary cases → error handling
- **Scenario titles: `Family — distinguishing condition`.** Lead with the behavior family that sibling scenarios share (the action or subject: `Auto-deduct`, `Save`, `Delete row`, `Negative source`); after the em-dash put only what differs. The prefix groups siblings together when titles are sorted; the suffix is the part you scan. Never restate the Feature in either part. `Save — blocked when amount is zero` / `Save — blocked on wrong sign` / `Save — valid split applies rows`, not `Saving a zero line is blocked`. Single-of-a-kind scenarios still take a family prefix so they sort with their kin.

## Tables vs Prose

Prefer prose. When the input or outcome spans several rows, use a data table rather than stringing values into prose; add a `| note |` column when a row's result isn't self-evident.

## Output

Gherkin block followed by a short **Coverage Notes** section (3–6 bullets) explaining what was included, what was intentionally omitted, and which scenarios combine multiple validations.
