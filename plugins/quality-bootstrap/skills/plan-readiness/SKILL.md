---
name: plan-readiness
description: Decide whether an implementation plan is ready to execute against its spec — one fresh-context pass that produces an acceptance-criterion → task → test traceability table, the tasks without an automated verify command, BLOCKERs each tied to a concrete failure scenario, Review Focus coverage, a plan-size check and a PASS / CONCERNS / FAIL verdict, while keeping DECISIONS.md so settled questions stay closed. Use after a plan is written and before anyone executes it — whenever someone asks "is this plan ready?", "check the plan against the spec", "readiness review", "gate the plan", or a workflow stage must decide whether execution may start — even if they only say "look over the plan before we run it".
---

# Plan readiness

One review pass that answers a single question: **if this plan is executed exactly as written, will the result meet the spec?** It is a gate, not a design review. Plans fail in execution for a small set of reasons — a requirement no task delivers, a task nobody can verify automatically, a step that is wrong for a concrete input, or a plan too big to execute coherently. Everything else (style, naming, alternative designs, extra tests nobody asked for) costs a round of rework and buys nothing, so it is left out entirely.

## Inputs

- **Spec** and **plan** paths — from the arguments or the task. If either is missing, look for it (the plans directory, the spec the plan names); if you still cannot find it, ask the user for the path (AskUserQuestion) rather than stopping — a missing input is the one question that needs no bar.
- **Plans directory** — read `docs/quality/toolchain.md` → "Repo facts" → plans directory. If the repo does not record one, use the plan file's own directory.
- **`DECISIONS.md`** in the plans directory (create it on first use, see below).

## Deciding and asking

The review should run to a verdict without a human. Every question you put to the owner stops their work and often a whole workflow, so a question has to be worth more than that stop. Decide everything you can; ask only what only the owner can answer.

**The bar.** Ask a human only when all three hold:

1. **Product, not implementation.** The answer changes what the product does or promises — scope users will notice, behaviour they see, data or contracts other people rely on, cost, legal, security or privacy posture. How the code delivers it — APIs, structure, task order, phasing, test approach, tooling, error handling, which later phase picks up a deferred piece — is yours, however important.
2. **Costly to reverse.** Undoing the choice later means migrating persisted data, breaking a published API or contract, taking back something users already saw or relied on, or undoing an action outside the repository. A choice the next plan or commit can change is cheap, even when it deviates from the spec for this phase.
3. **No clear winner after research.** You researched it (below) and two or more options are still about equally good. If the evidence favours one, that one wins.

**Research before every decision that the plan's correctness depends on — whether you will decide it or ask it.**

- Read what the repo already records — the spec, `DECISIONS.md`, ADRs, the docs, the existing conventions — as input, not as authority: they tell you the context and what was chosen before, not that it was right.
- Always look up current best practice and industry standards on the web — official documentation, standards, widely adopted references — instead of answering from memory, also when a recorded decision or ADR already covers the point.
- If an installed skill or agent covers the decision's domain (UI and UX design, API and interface design, security, data modelling, accessibility, …), apply it: a specialist's method beats a generalist's guess. Choose it from what this session offers; if nothing fits, research alone is enough.

**Then act.**

- **The bar is not met** (an implementation question, a reversible choice, or a clear winner): decide. Take the best option, log it in `DECISIONS.md` (by: review) with the reason and the evidence — the sources and skills it rests on — and continue. If the decision means the plan must change, it is a FAIL item for the planner, not a question.
- **The bar is met:** ask with the **AskUserQuestion** tool after the review is done, never mid-review, so each question comes with the full picture. Say what you found and why it is the owner's call (how it meets each of the three conditions, one line each), give the options with their tradeoffs and the evidence, and put your recommendation first — or say plainly that the research gives none. Log the answer in `DECISIONS.md` (by: human) and judge the plan again with it.

**Recorded decisions and ADRs can be overridden.** Always pick the best option for the issue. When the research shows a better option than one recorded in `DECISIONS.md` or an ADR, override it the same way you decide anything else — never by asking again what was already asked: log a new entry that supersedes the old one (with the evidence that tips it), make the plan change a FAIL item, and when the old choice is an ADR, add to that item that the planner writes a superseding ADR. Overriding an answer a human gave (by: human) is allowed only on evidence that was not available when they answered; list each such override first in the report so the owner sees it. Never stop, end the review or hand back an unfinished verdict because you want a human's input — also not when a workflow invoked you.

## Fresh context

The author of a plan reads what they meant, not what they wrote. If you wrote or edited this plan in the current session, dispatch one subagent to do the review with only the spec, the plan, `DECISIONS.md`, this skill and the repository; relay its report. In a fresh session (e.g. a workflow stage) do it yourself.

## Steps

### 1. Load recorded decisions

Read `DECISIONS.md` and the ADRs the plan touches. They are the starting point, not the verdict: check each one the plan relies on against the research (Deciding and asking) and override it when a better option exists. What you must not do is churn — re-raise the same point without new evidence, or reopen a choice that is still the best one in different wording. That makes the two-round limit meaningless.

### 2. Acceptance criteria as EARS with ids

Find the acceptance criteria of the part of the spec this plan implements (a spec may cover several phases; criteria of other phases are out of scope). Each must read as an EARS requirement with an id:

```
AC-<n>: WHEN <trigger> THE system SHALL <response>
```

(also `WHILE <state> …`, `IF <unwanted condition> THEN THE system SHALL …`, `WHERE <feature> …`, or plain `THE system SHALL …`). If ids are missing, add them in the spec — the repo's planning rules require ids, and the plan, the review and the verify stage all cite them — numbering in document order and continuing any existing numbering; add the id and EARS form next to each existing criterion rather than writing a new section, so the spec's structure stays as its author left it. Restate a criterion in EARS form only when the meaning is unambiguous; otherwise give it an id and keep its wording. Then settle the ambiguity as Deciding and asking says: usually the spec's context and the research make one reading the clear winner — log it in `DECISIONS.md` and review the plan against it; ask only when the readings differ in a way that meets the bar. Never invent, drop or strengthen a requirement. Commit the spec change alone (`git commit -- <spec>`), before the report.

### 3. Traceability table

For every AC in scope: which tasks implement it, which test proves it, and a status. Read the plan's tasks for their AC references; where a task does not name its AC ids, infer them and note that the task should name them.

| AC | Tasks | Test(s) | Status |
| -- | ----- | ------- | ------ |
| AC-1 | 2, 3 | `orders.test.ts` "rejects expired cart" | covered |
| AC-2 | — | — | **no task** |
| AC-3 | 4 | — | **no test** |

A test counts only if it asserts the behaviour the AC states (not merely that code runs).

### 4. Verify commands

List every task without an **automated verify command** — a command that exits non-zero when the task is not done (a test run, typecheck, build, script). "Check in the browser", "confirm it looks right" or "run the app" are not automated. Name the task and what command would do.

### 5. BLOCKERs

A BLOCKER is a defect in the plan that makes the executed result wrong against a stated requirement or simply incorrect: a wrong algorithm or API use, a step that contradicts the spec, a dependency on code that does not exist, a task order that cannot work, a missing migration the next task assumes, a verify command that cannot run or cannot fail.

Reading is not enough — the defects that sink executions are the ones nobody tried. Spend the effort here:

- **Starting state.** Run the repo's build and the test command the plan's verify steps rely on, as the tree is now (install dependencies in a scratch copy or with the lockfile if they are missing; never change tracked files). A plan whose first verify step cannot run on today's tree is blocked, whatever its tasks say.
- **Claims about code.** Open every file, symbol, signature and path the plan says exists and compare; a call with the wrong arguments is a compile error waiting.
- **Risky steps.** For each step whose correctness depends on runtime behaviour — rounding, encoding, normalisation, regexes, ordering, process and signal handling, file-system edge cases (symlinks, sizes), shell quoting on each target OS, a library's defaults, what a tool prints or exits with — check it with a few lines in a scratch file or REPL against the plan's own code, rather than reasoning from memory.
- **Verify commands.** Make sure each would fail when its task is not done (a filtered test run that matches nothing usually exits 0) and that the counts and names it relies on are right.
- **Spec constraints the plan must honour** (security rules, limits, platform rules): trace each to the code that enforces it.

Every check you ran goes into the report's evidence column, so the planner can trust the finding without re-deriving it.

**Containment — experiments must leave no trace outside the review.** A review often runs unattended (a workflow stage), on a developer's machine or a shared server, so:

- Work in one temporary directory you create (a scratch copy of the repo, or a scratch project). Install dependencies only inside it, from the lockfile or already-installed tools; never globally, per-user, in WSL or another OS, or with a system package manager. Start no long-running services and bind no ports. Delete the directory at the end.
- If a check needs a runtime, OS or service that is not already available, do not set it up: record the claim as "not verified — needs <what>" in the report. An unverified risky claim is a CONCERN at most, never a BLOCKER.

**Budget — spend the time where defects are most likely.** Order checks by risk: the starting state and the verify commands first, then the steps whose correctness depends on runtime behaviour, then everything else. Stop experimenting after about 15 minutes of checks (a few dozen commands) and list what you did not get to. Once a defect class already fails the plan, note further instances briefly instead of proving each one.

Every BLOCKER must name a **concrete failure scenario** — the input or state, what the plan's code does, and what the spec requires instead (e.g. "amount 2.345 → `Math.Round(x, 2)` gives 2.34 (banker's rounding); AC-4 requires 2.35"). If you cannot construct one, it is not a BLOCKER: drop it, or raise it as a question only if it meets the bar in Deciding and asking.

### 6. Review Focus coverage

Plans written with superpowers carry a "Review Focus" section: the input classes or failure modes the spec implies that are most likely to bite users. For each line, find the test in the owning task. Report lines without a test, and inputs the spec clearly implies that the section misses. A missing section is a finding.

### 7. Plan size

Count the tasks. More than ~10 means the phase should be split into vertical slices — a FAIL item with a suggested split (which slice goes first is the planner's call: the next slices follow, so nothing is lost). Compare the plan's length with the part of the spec it implements: a plan many times longer (roughly > 5×, excluding the spec's own code samples) is usually pasting implementation instead of planning it — report it.

### 8. Verdict

| Verdict | When | What happens next |
| ------- | ---- | ----------------- |
| **FAIL** | any BLOCKER, any AC with no task or no test, any task without an automated verify command, a plan over the size limit, or a decision you took that the plan must follow | The planner fixes these — they need no human judgement. |
| **CONCERNS** | no FAIL item, but a question that meets the bar in Deciding and asking | Ask it now, log the answer in `DECISIONS.md`, then judge again: PASS, or FAIL when the answer means the plan must change. CONCERNS stays the final verdict only when the user declines to answer. |
| **PASS** | none of the above | Execute. |

Do not soften FAIL into CONCERNS to be polite, and do not turn a decision you can make into a question: a reviewer that asks what it could have decided has not finished its job.

### 9. Rounds

A plan gets **at most two rounds**. The round number comes only from the previous readiness report for this plan (see Output): none → round 1; its round 1 → round 2. Decision log entries do not count as rounds. If this would be round 3 — the plan already failed twice — and the caller sets no round budget of its own, decide it yourself rather than asking: when round 2 left fewer open items than round 1, review it as a further round; otherwise write a short report with verdict CONCERNS, "round limit reached — the revisions are not converging", and those open items. A caller that sets its own round budget (a workflow's `## Review round N of M`) decides the limit instead; follow it.

### 10. DECISIONS.md

Log only questions this review actually had to settle — points a careful reviewer would otherwise raise again next round: an interpretation of an ambiguous requirement you chose, a tradeoff or product choice below the bar that you decided, or a human's answer to a question. Do not log the plan's ordinary choices you simply agree with (that rubber-stamps the plan on the owner's behalf). Mark product choices you took without asking "owner may revisit", so the owner can find them. Most reviews log zero to three entries.

```markdown
# Decisions

Decisions for the plans in this directory. A later entry may supersede an earlier one when research shows a better option.

## D-<n>: <the decision, one line>
- Reason: <why, with the evidence: sources, skills applied>
- Revisit if: <the observable condition that would reopen it>
- Supersedes: <D-<m> or ADR-<k>, and what changed — only when it overrides one>
- Logged: <YYYY-MM-DD>, <plan file>, readiness round <r> (<by: review | human>)
```

Append, never rewrite earlier entries; to override one, append a superseding entry and add "Superseded by D-<n>" under the old one. Commit it alone with the report.

## Output

Write the report next to the plan as `<plan-name>.readiness.md` (overwrite the previous round's report; the round history lives in its header and in git):

```markdown
# Readiness: <plan file>
Spec: <path> (phase / section) · Round: <1|2> · Verdict: **PASS | CONCERNS | FAIL**

## Traceability
<table from step 3>

## Tasks without an automated verify command
## BLOCKERs
- B1 — <task n>: <defect>. Failure scenario: <input/state → actual → required>. Fix: <one line>.
## Review Focus coverage
## Plan size
<n tasks; plan ≈ k× the spec section>
## Questions asked (question, why it met the bar, answer, decision id)
## Decisions logged this round (taken by the review; owner may revisit)
## Next: ordered edits for the planner
1. <the smallest change that clears each FAIL item, in the order the planner should make them>
```

Leave a section with "none" rather than deleting it, so readers know it was checked. Commit the report. End your reply with the verdict and the report path on the last line — `Verdict: FAIL — docs/plans/foo.readiness.md` — so a workflow can read it.

## Not in scope

Style, naming, formatting, code organisation preferences, alternative architectures, performance or security hardening the spec does not ask for, and "would be nice" tests. If you notice one that will cause a real defect, it is a BLOCKER with a failure scenario; otherwise it does not appear in the report.
