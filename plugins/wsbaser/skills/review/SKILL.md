---
name: wsbaser:review
description: Settles the open issues of a topic and gets the owner's sign-off on one page — finds the issues (PR review comments, questions before implementing a task, points raised by another skill), has each researched and decided, explains each at the depth it needs, publishes a review page where the owner confirms or changes each decision, and returns the decision list. Does not implement anything. Use when asked to review PR comments and propose answers, analyse a task and prepare open questions, "prepare a review artifact", "what do you need me to decide", or when a skill needs several decisions from the user at once.
---

# Review

Turn a topic into a list of issues, have each one decided and explained, publish one page where the owner confirms or changes every decision, and return the settled decisions to whoever asked. You orchestrate; the other skills do the deciding, explaining and styling.

In this file, `<base>` is this skill's base directory and `<skills>` its parent, where the sibling skills live. `<record>` is the path to this review's `review.json`.

Read `<base>/references/record.md` (the record's fields and stages) and `<base>/references/decision-text.md` (what the owner pastes back) before step 1. Field and stage names below are theirs.

## Validating the record

After every step that writes the record, run `python <base>/scripts/check_record.py <record> --stage <stage>`. It prints one error per line and exits 1 on errors. Fix what is yours (the `review` object, issue ids, titles, rounds, order) and run it again. Errors in fields another skill fills go back to that skill with the printed lines. After three rounds that still print errors, stop and give the caller the remaining lines. Never publish a record that fails `ready`.

## Starting from an existing record

When the caller hands you an existing `review.json`, do not start over:

- It has `review.artifactUrl` and the caller brings new issues: go to step 10.
- It has `review.artifactUrl` and nothing new: the page is out; go to step 6.
- Otherwise find the highest stage it passes (`intake`, `decided`, `ready`) and continue with the step after the one that reached it. A record that passed `ready` and has no `artifactUrl` continues at step 5.

## 1. Intake

Issues come from a slot: one file per kind of source, each opening with a `when:` line. The set grows by adding files, so never assume which exist.

1. List `<base>/intake/` and, if it exists, `.claude/review/intake/` under the root of the project being worked on. When both hold a file with the same name, the project's file wins.
2. Read only the frontmatter `when:` line of each file and load the one that matches the topic and how it was handed to you.
3. Follow that file. It says how to read the source, what becomes an issue, and how to fill each issue's intake fields.
4. If no file matches, read the topic and every source it names in full (the conversation, files, links, code), and list as issues the open points where a wrong guess costs rework. `origin` holds a claim only when someone else made it.

Create the folder `review-<review.id>/` where the caller says, else in the session scratchpad, and write `<record>` with `schema: 1`, the `review` object (`round: 1`) and the issues. Validate at `intake`.

## 2. Frame

Decide, for this task and not from a preset:

- **Which attributes matter.** Pick the few labels that help the owner choose here (for example severity, effort, reversibility, blast radius). Pass them to the decision step.
- **The order.** Dependencies before dependents, then by stakes, highest first. Dependencies are known only after step 3, so reorder the `issues` array then. Ids never change when you reorder.

## 3. Decide

Invoke `wsbaser:decide` through the Skill tool with `<record>`, the attributes from step 2, and pointers to everything you read at intake (files with `file:line`, links, the conversation). It fills options, recommendations, `needsOwner`, dependencies and agent decisions, and validates at `decided`. Then apply the order from step 2 and validate at `decided` again.

## 4. Explain

Invoke `wsbaser:explain` through the Skill tool in embedded mode with `<record>`. It writes each issue's `explanation` and the option `blocks` that choosing needs, and validates at `ready`.

## 5. Build and publish

1. Invoke `wsbaser:report-design` and read its `references/decision-page.md`. Load `artifact-design`, as the Artifact tool requires.
2. Write the page freehand from the record into `review-<review.id>/page.html`: one column, every issue in record order with its header, body and decision block, `#review-data` built from the record as `decision-page.md` says. Paste `<skills>/report-design/assets/tokens.css` and `<skills>/report-design/assets/review-page.js` unchanged.
3. Validate at `ready`, then go through report-design's before-publishing checks.
4. Publish with the Artifact tool. On the first publish, write the URL into `review.artifactUrl` in `<record>`. Every later publish goes to that same URL: in this session, publish the same `page.html` path again; in a later session, pass `review.artifactUrl` as `url` (the Artifact tool reads the artifact first).

## 6. Hand over and wait

Give the owner the link and one line of what needs them: the count of issues with `needsOwner: true` against the total ("2 of 9 need you"), or "None need you; confirm or change any of them". Then stop and wait for the pasted decisions. Always wait, even when no issue needs the owner.

When the caller announces the page and collects the owner's answer itself, give the caller the link and that line instead, and take the answer it passes back as the paste.

## 7. Read the paste

First check the paste's first line. If it names a round lower than `review.round`, it came from a tab opened before the last republish: ask the owner to reload the page and copy again, and do not parse it.

Save the pasted text next to `<record>` as `decisions-round-<review.round>.txt` and run:

```bash
python <base>/scripts/parse_decisions.py <record> < <folder of record>/decisions-round-<review.round>.txt
```

It merges the decisions into `<record>`, writes it back, and prints JSON with `settled`, `undecided`, `disputed` and `problems`.

- **Another review.** A problem saying the text is for another review means nothing was applied. Tell the owner which review the paste belongs to and ask for the text from this page's link.
- **Unreadable or missing issues.** For each problem, tell the owner in plain words which issue could not be read and why (cut off, missing, an option the issue does not have). The parser marks those issues undecided, so ask for a fresh, complete paste of Copy decisions and run step 7 again. Do not fill the gaps yourself.
- **"Accept all recommendations"** instead of a paste: set every issue that has a recommendation to `{ "by": "owner", "choice": <recommended option>, "note": "", "status": "decided" }`, keeping agent decisions as they are; issues with no recommendation stay undecided. Write the decision text for the return yourself, from the record, in the format of `decision-text.md`.

Undecided issues with no problems mean the owner has not answered them yet: say which ones and wait for a new paste.

## 8. Settle disputes

Rework every issue the summary lists as `disputed`, and every decided issue whose note argues against the choice (a note that only adds detail is not a dispute; it goes back to the caller with the decision).

1. Raise `review.round` by one.
2. Invoke `wsbaser:decide` naming those issues for a re-think, with each owner's note as new input. If a reworked issue's option ids change, name the issues that depend on it too, so their maps are redone.
3. Set each reworked issue's `round` to the new `review.round`. This is what makes the page drop the owner's saved state for that issue only. Keep the id. Leave every other issue's `round` and decision as they are, so their earlier decisions stay on the page and in the record.
4. Invoke `wsbaser:explain` in embedded mode, naming the reworked issues to rewrite.
5. Validate at `ready`, rebuild the page, republish to `review.artifactUrl`, and go back to step 6. Say which issues were reworked and what changed in one line each.

## 9. Return

Return only when the summary says `settled: true`, in this form:

```
Review settled: <number of issues> decisions
<the decision text: the owner's last paste, or the text you wrote for "accept all">
<record>
```

If the owner says to stop before that, return:

```
Review not settled
Undecided: <ids>
Disputed: <ids, when any>
<record>
```

Take the ids from the last parse summary, or from the record's decisions when nothing was pasted. The caller must not act on the issues listed there.

## 10. Later rounds from the caller

When the caller invokes you again on the same `<record>` with new issues (applying the decisions raised them):

1. Raise `review.round` by one. Add the new issues with ids not used before and `round` set to the new round. Validate at `intake`.
2. Run steps 3 and 4. Decide fills only issues without options, so earlier decisions stay. Tell explain which issues are new.
3. Re-apply the order, validate at `ready`, rebuild the page, republish to `review.artifactUrl`, and continue from step 6.

## What this skill does not do

- It does not implement any decision. The caller acts on the returned list.
- It posts nothing back to where the issues came from: no replies, comments, votes or status changes.
- It never decides silently. Every decision, the agent's included, is on the page and confirmed by the owner's paste before it is returned.
