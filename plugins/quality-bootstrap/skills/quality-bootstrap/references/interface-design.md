# Interface design recipe

Copied by quality-bootstrap to `docs/quality/interface-design.md`. Read it when a plan introduces a **new interface between modules** — packages, layers, services, processes, or a port that more than one adapter will implement. Not for private helpers inside one module.

Why a recipe: an interface that crosses modules is the most expensive thing in a plan to change later — every caller and every adapter depends on it. Designing it once, in passing, while writing tasks gives the first idea, which is rarely the best. This recipe runs the vendored `codebase-design` skill ("design it twice": several radically different candidates) without stopping for questions, scores the candidates with the vendored `api-and-interface-design` rubric, and records the result as an ADR the plan's tasks then implement.

## 1. Assemble the brief first

`codebase-design` asks the user for whatever context it lacks and pauses to show its framing. A plan session — often unattended — supplies everything up front instead, so the skill has nothing to ask. Write the brief into the ADR draft (section "Context"):

1. **Requirements** — the spec's acceptance criteria (AC ids) that cross this seam, quoted.
2. **Callers** — every existing and planned call site, as `path:line` with one line on what each needs. Find them with the `feature-dev` `code-explorer` agent; do not guess.
3. **Behind the seam** — what the implementation hides and each dependency's category (in-process, local-substitutable, remote-but-owned, true external — `codebase-design`'s DEEPENING.md).
4. **Constraints** — performance, security, tenancy or isolation, idempotency and retries, compatibility with existing callers, platforms, and anything the spec or `CLAUDE.md` fixes.
5. **Domain language** — the glossary file recorded in `docs/quality/toolchain.md` → "Repo facts" → glossary (or "none"). Name types, methods and errors with its terms verbatim. Terms the design must introduce are listed as proposed glossary additions in the ADR, not silently invented.

## 2. Run codebase-design without stopping

Follow `codebase-design` and its DESIGN-IT-TWICE process with these substitutions:

- "Show this to the user" → write it into the ADR draft and continue immediately.
- Spawn the parallel candidate designers with the brief above and one constraint each: **minimal** (1–3 entry points), **flexible** (many uses, extension), **common caller** (default case trivial), and **ports & adapters** when the seam crosses a dependency that varies (two real adapters, or a remote/external dependency). At least three candidates.
- Each candidate returns the interface in the repository's language (types plus invariants, ordering, error modes), a caller example, what it hides, its adapters, and its trade-offs.
- Do not ask the user to choose. You choose (step 3); the human reviews the ADR.

## 3. Score the candidates

Score every candidate 0–2 on each criterion, one line of evidence per cell. The first eight come from `api-and-interface-design`, the last three from `codebase-design`:

| Criterion | 2 = |
| --------- | --- |
| Hyrum's law | Observable behaviour is the documented contract; nothing incidental (ordering, timing, error text, field presence) is left for callers to depend on |
| Contract first | Types, invariants and error modes are fully specified before any implementation |
| One error shape | Every failure reaches callers in one consistent form |
| Validation at boundaries | Untrusted input is validated where it enters; inside the seam types are trusted |
| Additive change | Foreseeable growth (new channel, provider, field, variant) is an addition, not a breaking change |
| Discriminated unions | Variants and results are tagged unions, exhaustively checkable — in languages without them, the idiomatic equivalent (sealed hierarchy, `OneOf`, enum + payload) |
| Branded ids | Ids crossing the seam are distinct types, not raw strings/ints (branded types, strongly typed ids, value objects) |
| Idempotency | Calls with side effects are safe to retry (idempotency key or naturally idempotent), as the callers' retry behaviour requires |
| Depth | Much behaviour behind a small interface (the deletion test) |
| Locality | Change and knowledge concentrate behind the seam, not across callers |
| Seam placement | The seam sits where something actually varies |

Mark a criterion `n/a` with the reason when it truly does not apply (a pure in-process query has no idempotency question). Pick the highest total; a hybrid is allowed when it keeps the winner's score and fixes a named weakness. Ties go to the smaller interface, then to the simpler common-caller example.

## 4. Write the ADR

`docs/adr/NNNN-<slug>.md` — next four-digit number in that folder (create it at `0001` if absent; follow an existing ADR format and numbering if the repo already has one):

```markdown
# NNNN. <Interface name>: <decision in a few words>

Status: Proposed · Date: <YYYY-MM-DD> · Plan: <plan path> · Spec: <spec path> (AC-…)

## Context
<the brief from step 1: requirements, callers, behind the seam, constraints>

## Decision
<the chosen interface in the repo's language, with invariants, ordering and error modes;
 one caller example>

## Candidates considered
<one paragraph per candidate> and the score table from step 3

## Consequences
<what gets easier, what gets harder, adapters to write, contract tests every adapter must pass>

## Proposed glossary additions
## Open business questions
- <question only a product owner can answer> — plan assumes: <default>, reversible: yes/no
```

`Status: Proposed` until a human accepts it. Commit the ADR alone.

## 5. Open business questions

Pricing, policy, user-visible behaviour, legal or contractual limits — questions technical judgement cannot settle — go in the ADR's last section and in the plan session's final report, each with the default the plan assumes. Technical questions are decided, not listed. If a business answer would change the interface itself and the default is not reversible, the plan session stops for the human instead of planning on a guess.

## 6. Hand back to the plan

Tasks implementing the interface cite the ADR, start with the contract (types and a contract test suite every adapter must pass), and name their AC ids and verify commands like every other task.
