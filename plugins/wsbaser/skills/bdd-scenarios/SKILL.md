---
name: wsbaser:bdd-scenarios
description: Produces optimized Gherkin scenarios covering critical paths, edge cases, and error handling. Use in planning phase before writing test code. Trigger: "write scenarios", "plan tests", "what to test", "give me gherkin", or analyze a branch for test coverage. Do NOT trigger for implementing test code, fixing tests, or Gherkin syntax questions.
---

# Test Scenario Planning Rules

## Workflow

Before anything else, find the existing feature file(s) related to the capability you're covering — this is today's scope. Every rule below applies across that whole scope, not just to newly drafted scenarios: existing scenarios inside it get brought into compliance too, pre-existing or not.

This skill covers two different kinds of concern: getting the scenario's *behavior* right (Coverage, Optimization, the mechanical Gherkin Rules below), and finishing it off (Titling, Severity, Naming). Applying both at once, on every scenario, while also drafting its content is how a rule quietly gets skipped. Split it into two passes instead:

1. **Draft.** For everything in scope, write or revise the scenarios' `Given`/`When`/`Then` bodies, applying **Coverage**, **Optimization**, and the **Gherkin Rules** below. Do not title the scenarios and do not tag severity yet — just get the behavior right.
2. **Finish.** Take the finished draft and, in a separate focused pass, read and apply these three reference files and nothing else. The first two take the draft as input; the third takes the target folders on disk — do not let it collapse into a check of the draft:
   - `references/titling.md` — per scenario: capability vs. special-case shape for each title
   - `references/severity-tagging.md` — per scenario: the 5-tier `@severity-*` rubric
   - `references/naming-organization.md` — per folder: placement (the tree indexes the app's UI; each file at the level of its subject) and priority numbering, run against a fresh directory listing of every target folder (any folder the task adds, renames, or moves a file in or out of), never against the draft. Bring each folder into compliance — pre-existing sibling renames and moves included — and record the result as the Output's Folder audit tables.
   Hand this pass to a subagent (e.g. the Agent tool) — give it the draft, these three files, and read access to the scenarios tree (moves create new target folders mid-check, so a static listing isn't enough), nothing about how you arrived at the draft. It must return the titled, tagged scenarios plus completed Folder audit tables; execute any moves and renames it verdicts before assembling — a fresh reader is less likely to rubber-stamp a title, a tier, or a non-compliant sibling than you re-reading your own work.
3. **Assemble.** Combine the finished, titled, tagged scenarios with the file decision and the Folder audit tables into the final Output, then verify the Checklist at the bottom of this file line by line.

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

## Tables vs Prose

Prefer prose. When the input or outcome spans several rows, use a data table rather than stringing values into prose; add a `| note |` column when a row's result isn't self-evident.

## Output

Gherkin block, followed by:
- **File**: per capability touched, the relative path/filename and a one-line reason (existing file owns it / new file for a gap / existing file restructured to match the capability map)
- **Folder audit**: one table per target folder, from the Finish pass's fresh listing — every direct `.feature` file gets a row, including files this task never touched:

  ```
  Folder: Expenses/PurchaseInvoices/Dialog/ — 4 direct .feature files
  | Final name              | Was                                     | Action    |
  |-------------------------|-----------------------------------------|-----------|
  | 1. Post invoice.feature | Post invoice.feature                    | renamed   |
  | 2. Split line.feature   | —                                       | created   |
  | 3. Attachments.feature  | 3. Attachments.feature                  | unchanged |
  | 4. Duplicates.feature   | Expenses/Duplicate invoice logic.feature | moved     |
  ```

  `Action` is exactly one of `unchanged` / `renamed` / `moved` / `created`. `renamed` and `moved` = already applied on disk (`git mv` for tracked files), never merely proposed; a moved file rows in its destination folder with `Was` as its old path from the scenarios root. `unchanged` requires name and placement to already satisfy the naming-organization rules — an unnumbered file in a 2+ folder never qualifies, nor does a file whose subject is narrower than the folder it sits in. If every folder was already compliant, say so beneath the table.
- **Coverage Notes** (3–6 bullets) explaining what was included, what was intentionally omitted, and which scenarios combine multiple validations

**Checklist:** every target folder freshly listed during Finish · every direct `.feature` file rowed in a Folder audit · every `.feature` file placed at the level of its subject · 2+ files → numbered 1..N, no gaps · filenames read like sentences · `renamed`/`moved` rows applied on disk, not proposed · every scenario title shape-checked and severity-tagged · Coverage Notes present.
