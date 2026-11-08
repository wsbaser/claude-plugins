---
name: plan-readiness
description: Decide whether an implementation plan is ready to execute against its spec by hunting the defects implementation will not catch on its own — behaviour wrong against the spec (org/tenant isolation, security, concurrency, money and billing, data safety, packaging) and acceptance criteria whose planned tests cannot actually fail — ending in a PASS / CONCERNS / FAIL verdict, and patching small plan defects itself instead of looping back. Use after a plan is written and before anyone executes it — whenever someone asks "is this plan ready?", "check the plan against the spec", "readiness review", "gate the plan", or a workflow stage must decide whether execution may start — even if they only say "look over the plan before we run it".
---

# Plan readiness

One review pass, one question: **if this plan is executed exactly as written, will the result do what the spec says where it matters?**

The review is narrow by design. Evidence from 54 reviewed plans: about two thirds of all findings were mechanical — wrong paths, missing commands, task sizing, wave order — and when implementation hit each of them it fixed it in minutes; meanwhile the findings that paid for the review were the ~27 silent behaviour defects (a cross-tenant cache leak, a volume billed twice, a smoke step aimed at live data, a package missing from the shipped image) that no planned test would have failed on and that would have shipped. So this review spends all of its effort on what implementation cannot save, and none on what implementation fixes for free.

## In scope — only these two checks

1. **Behaviour against the spec.** Does any step of the plan, executed as written, produce behaviour the spec forbids — or omit behaviour the spec requires — in a way no planned test would catch? Hunt deliberately in the classes where silent defects live:
   - **Isolation** — org/tenant/user data crossing a boundary (caches and maps keyed too narrowly, shared singletons, paths without the owner in the key).
   - **Security** — secrets or tokens exposed to the wrong party, unvalidated input reaching a sensitive sink, an admission check the spec requires that no task implements.
   - **Concurrency** — races, lost or duplicated items, cross-node clock comparisons, lock keys that don't match the resource.
   - **Money** — double billing, rounding, units, a numeric type the storage layer will reject.
   - **Data safety** — a step that can touch live data or delete user state; environment variables that override the plan's own isolation (e.g. a `cross-env VAR=` that beats the caller's).
   - **Packaging** — a new module missing from the shipped image, bundle or installer; platform differences (path separators, case sensitivity, signals).
2. **AC coverage that can fail.** Every acceptance criterion in scope has a task that implements it and a test that would go red if the behaviour were wrong. A test that merely exercises the code, measures something unrelated, or passes on a defective implementation does not count — say why it cannot fail.

## Out of scope — implementation fixes these for free

Wrong file paths, symbol names or signatures (the first compile finds them); missing or weak per-task verify commands; task count, plan length, style or formatting; wave ordering; the wording of planned tests; alternative designs; hardening the spec does not ask for. If you notice one of these incidentally, give it one line under **Notes** in the report — it never becomes a BLOCKER, never changes the verdict, and you never spend verification effort hunting for more of them.

## Inputs

- **Spec** and **plan** paths — from the arguments or the task. If either is missing, look for it (the plans directory, the spec the plan names); if you still cannot find it, ask the user for the path (AskUserQuestion) rather than stopping.

## Fresh context

The author of a plan reads what they meant, not what they wrote. If you wrote or edited this plan in the current session, dispatch one subagent to do the review with only the spec, the plan, this skill and the repository; relay its report. In a fresh session (e.g. a workflow stage) do it yourself.

## Steps

### 1. Acceptance criteria as EARS with ids

Find the acceptance criteria of the part of the spec this plan implements (criteria of other phases are out of scope). Each needs an id and EARS form:

```
AC-<n>: WHEN <trigger> THE system SHALL <response>
```

(also `WHILE <state> …`, `IF <unwanted condition> THEN THE system SHALL …`, `WHERE <feature> …`, or plain `THE system SHALL …`). If ids are missing, add them in the spec next to each existing criterion — numbering in document order, continuing any existing numbering, keeping the author's structure. Restate in EARS form only when the meaning is unambiguous; otherwise keep the wording and note the ambiguity. Never invent, drop or strengthen a requirement. Commit the spec change alone (`git commit -- <spec>`), before the report.

### 2. Traceability

For every AC in scope: which tasks implement it, which test proves it, and whether that test can actually fail.

| AC | Tasks | Test(s) | Status |
| -- | ----- | ------- | ------ |
| AC-1 | 2, 3 | `orders.test.ts` "rejects expired cart" | covered |
| AC-2 | — | — | **no task** |
| AC-3 | 4 | — | **no test** |
| AC-4 | 5 | p95 latency assertion | **cannot fail** — measures successful runs; a stall never enters the sample |

### 3. Hunt behaviour defects

Walk the plan's steps and code samples against the spec's constraints, class by class from **In scope**. Reading is not enough for the risky ones — the defects that ship are the ones nobody tried:

- For each step whose correctness depends on runtime behaviour — key construction, cache sharing, rounding, encoding, ordering, env-var precedence, a library's defaults — check it with a few lines in a scratch file or REPL against the plan's own code, rather than reasoning from memory.
- **Targeted experiments only — never whole-repo gates.** Do not run the repo's full test suite, build, typecheck or quality gate: the workflow's own gate stage runs them anyway, they take minutes to tens of minutes, and a red result tells you about the tree, not the plan. Compile or run only the code in question — a single file, a scratch copy of one module, a REPL probe. If a claim can only be checked by a whole-repo command, record it as "not verified — needs <what>" instead.
- **Containment — experiments leave no trace.** Work in one temporary directory you create; install dependencies only inside it, never globally or per-user; start no services, bind no ports; delete it at the end. If a check needs a runtime or service that is not already available, record "not verified — needs <what>"; an unverified claim is a CONCERN at most, never a BLOCKER.
- **Budget.** Order checks by risk and stop experimenting after about 15 minutes; list what you did not get to. Once a defect class already fails the plan, note further instances briefly instead of proving each one.

Every BLOCKER names a **concrete failure scenario** — the input or state, what the plan's code does, and what the spec requires instead (e.g. "org A and org B both request `deploy`; the in-flight map is keyed by `name`, so B gets A's promise; AC-1 requires each org its own content"). If you cannot construct one, it is not a BLOCKER — drop it or put it in Notes.

### 4. Patch small defects yourself

A plan defect you can fix in a few lines **without changing the design or the behaviour** — a wrong path the correct file is obvious for, a typo in a command, a missing environment prefix, a task that forgot to name its AC ids — you fix in the plan directly, commit, and list under **Patched** in the report. This replaces a whole plan→review round that would change nothing else. Never patch behaviour, coverage or design: those belong to the planner, through the verdict.

### 5. Verdict

| Verdict | When | What happens next |
| ------- | ---- | ----------------- |
| **FAIL** | a behaviour BLOCKER, or an AC with no task, no test, or a test that cannot fail | The planner fixes these; the report's **Next** section lists the smallest edits in order. |
| **CONCERNS** | no FAIL item, but a question only the owner can answer (below) | Ask it now, then judge again: PASS, or FAIL when the answer changes the plan. CONCERNS stays final only when the user declines to answer. |
| **PASS** | none of the above — including when you patched small defects | Execute. |

Do not soften FAIL into CONCERNS to be polite, and do not fail a plan for anything in **Out of scope**.

### 6. Asking

The review runs to a verdict without a human. Ask the owner only when all three hold: the answer changes what the product does or promises (not how the code delivers it); the choice is costly to reverse (migrations, published contracts, actions outside the repo); and after research no option is clearly better. Everything below that bar you decide yourself and record in the report. Ask with AskUserQuestion after the review is done, never mid-review — state what you found, the options with evidence, your recommendation first. Record the answer under **Questions** in the report. Never stop, end the review or hand back an unfinished verdict because you want a human's input — also not when a workflow invoked you.

### 7. Rounds

A plan gets **at most two rounds**; the round number comes from the previous readiness report for this plan (none → round 1). Because small defects are patched in place (step 4), a second round should exist only when round 1 found behaviour or coverage FAILs. If this would be round 3 and the caller sets no round budget of its own: when round 2 left fewer open items than round 1, review it as a further round; otherwise report CONCERNS, "round limit reached — the revisions are not converging", with the open items. A caller that sets its own round budget (a workflow's `## Review round N of M`) decides instead.

## Output

Write the report next to the plan as `<plan-name>.readiness.md` (overwrite the previous round's report; history lives in git):

```markdown
# Readiness: <plan file>
Spec: <path> (phase / section) · Round: <1|2> · Verdict: **PASS | CONCERNS | FAIL**

## Traceability
<table from step 2>

## BLOCKERs
- B1 — <task n>: <defect>. Failure scenario: <input/state → actual → required>. Fix: <one line>.

## Patched (edits this review made to the plan)
## Notes (out-of-scope nits, not verdict items; unverified claims)
## Questions (question, why it met the bar, answer)
## Next: ordered edits for the planner
1. <the smallest change that clears each FAIL item, in the order the planner should make them>
```

Leave a section with "none" rather than deleting it, so readers know it was checked. Commit the report (and any step-4 plan patches) together. End your reply with the verdict and the report path on the last line — `Verdict: FAIL — docs/plans/foo.readiness.md` — so a workflow can read it.
