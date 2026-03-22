---
name: plan-test-scenarios
description: Analyzes the current context (feature description, Jira story, spec, code, or any requirement) and produces an optimized set of Gherkin test scenarios ready for automation. Use this skill whenever the user wants to plan, design, write, or generate test scenarios, test cases, or a test plan for a feature. Trigger on phrases like "write test scenarios", "plan tests", "what should we test", "generate test cases", "test coverage for", "give me scenarios for", "write a test plan" — even if the user doesn't say "Gherkin" explicitly. Always use this skill before writing any test code for a new feature.
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

- `Given` sets up pre-conditions (system state, authenticated user role, existing data)
- `When` describes one user action or event
- `Then` asserts a specific, observable outcome — use concrete values, not vague descriptions
- Use `Background` when 2+ scenarios share identical setup steps
- Use `Scenario Outline` + `Examples` table when the same flow runs with 3+ distinct data sets
- Order: critical path → alternative flows → edge/boundary cases → error handling
- **Scenario titles name only what's different.** The Feature name provides the common context — don't repeat it in every title. Line scenarios up side by side: the title alone should tell you which one you care about. "Company is delisted" is a good title; "New customer is marked inactive when the registry returns a delisted company" is not — it restates the Feature. Good examples from a cash withdrawal feature: "Account has sufficient funds" / "Account has insufficient funds" / "Card has been disabled" — each title is the distinguishing condition, nothing more.

## Output

Gherkin block followed by a short **Coverage Notes** section (3–6 bullets) explaining what was included, what was intentionally omitted, and which scenarios combine multiple validations.
