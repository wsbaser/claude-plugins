---
name: wsbaser:explain
description: Explains how something actually works — where a value is computed, which layer owns a decision, how data flows end to end, and why a bug appeared. Sizes the answer to the question and publishes the longer ones as a Claude artifact with diagrams. Use whenever the user asks how or where something works, says a flow is a black box, asks whether logic lives in the frontend or the backend, wants a data flow or pipeline traced, asks why a bug appeared or what changed, or says "explain", "walk me through" or "help me understand" — even when they frame it as a quick question rather than a request for a document. Also writes the per-issue explanations inside a review page when called by wsbaser:review.
---

# Explain

Explain how something actually works, to someone who did not write it, at the size the subject needs: one sentence when that is enough, ground-up when the reader lacks the background.

Read `references/writing-rules.md` first: always in the page and embedded modes, and for a terminal answer longer than a few lines.

In this file, `<skills>` is the plugin's skills folder: the parent of this skill's base directory, where the sibling skills used below live.

## 1. Pick the mode

| Mode | When | What you produce |
|---|---|---|
| Short answer | A question whose answer fits in a few lines. | The answer in the terminal. No artifact. |
| Explainer page | The explanation is worth returning to, is meant for someone else, or carries structure (order, comparison, several layers) that prose in a terminal would lose. | A page styled by `wsbaser:report-design`, published with the Artifact tool. |
| Embedded | The caller gives you the path to a `review.json`. | Explanation blocks written into that file. See section 6. |

Two judgements decide between the first two, and the request carries both:

- **How much.** A one-fact question gets a few lines, even when it is phrased as "explain".
- **How deep.** "It's a black box" asks for the ground up: what the pieces are and where each one lives. A precise symptom from someone already naming the right files asks only for the piece they are missing; re-explaining the rest buries the answer.

When the request is ambiguous, pick a level and go ahead. State the level you chose in one line, and what the other level would add. Do not wait for an answer.

## 2. Trace before writing

Follow the mechanism wherever it goes: other repositories, services, packages. A trace that stops at the working directory is the one that misleads.

- Separate the code that computes from the code that decides what to compute. Where one is shared and the other is not, that gap is usually the whole answer.
- For anything regression-shaped, establish what changed and when, and check the versions of shared dependencies, not only the repo's own history.
- Every claim traces to something you read. Plausible-sounding architecture is the failure mode of this task: it looks like the real thing until someone acts on it.
- What you could not confirm, you say, in the sentence that makes the claim: "checked by reading the code, not by running it".

Keep the `file:line` of everything you will cite while you trace; the explanation needs them.

## 3. Choose the form per subject

A form is one way of showing something. Forms live in a slot, one file per form, each opening with a `when:` line that says when it fits. The set grows by adding files, so never assume which forms exist: list them.

1. List `<skills>/report-design/forms/` and, if it exists, `.claude/review/forms/` under the root of the project being worked on.
2. Read only the frontmatter `when:` line of each file. When both folders hold a file with the same name, the project's file replaces the plugin's.
3. Load only the files whose `when:` matches the subject in front of you, and build each block the way its file says.

Plain prose is the default. Pick another form only when its `when:` line fits the subject better than sentences would, typically when structure, order or comparison is the point. Choose per subject, not per kind of request: two subjects rarely need the same shape.

In the terminal nothing renders, so use the plain-text equivalent of the form you would pick: Markdown, numbered steps, excerpts with their `file:line`.

## 4. Decide what is visible

- Short content is always visible. Never make the reader click to read a few sentences or a few lines.
- Fold only long extra depth the reader can decide without: multi-paragraph background, a long full listing, rejected options argued at length. A fold holds 600 characters or more, counted over the `text` and `code` fields inside it.
- Blocks without `text` or `code` (a table, a picture) count as 0, so a fold holding only those is rejected by the validator. Put long prose in `text` and long code in `code`; show tables and pictures inline.
- A fold's label says how much is behind it, in a unit the reader feels: "Background, 3 paragraphs", "Full listing, 48 lines".
- Show the gist above any fold. Never nest folds, and keep them to a few per item.

## 5. Explainer page

1. Load `wsbaser:report-design` (and `artifact-design`, as the Artifact tool requires). Follow its tokens, components and before-publishing checks.
2. Write the page freehand: one reading column, the answer at the top, then only the parts this subject needs.
3. Publish with the Artifact tool. Confirm each picture renders; a broken one fails silently and takes the explanation with it.
4. Reply with the link and the finding in a few lines, not a second copy of the explanation. A new artifact is private to its author; say so when the page is meant for other people.

## 6. Embedded mode

`wsbaser:review` gives you the path to a `review.json` that has reached stage `decided`. The record's contract is `<skills>/review/references/record.md`; read it first. In a later round it may also pass a list of issue ids to (re)write: then write only those and leave every other issue untouched. Without a list, write every issue.

Before writing, run `python <skills>/review/scripts/check_record.py <path to review.json> --stage decided`. If it prints anything, stop, write nothing, and tell the caller what it printed.

**What you change.** Only each issue's `explanation` and, where needed, its options' `blocks`. Every other field belongs to another skill; leave it as it is. Keep any option `blocks` already present (the decision step may have written them, a mockup for example); only add your own.

**What the page already shows.** The title, attribute chips, the whole `origin` quote with its verdict chip, each option's `label`, and the recommendation with its reason, confidence, sources and unverified claims are rendered from the record. Do not repeat them in the explanation; explain what the reader needs in order to judge them. Quoting a single part of the claim in order to judge it is not repeating it.

**Per issue.** Read what the decision step recorded (kind, origin, options, recommendation, sources), trace what you need yourself, then write blocks sized to that issue. Size by the subject, never by who decides: an issue the agent decided is explained as fully as its subject needs, not less than one that needs the owner.

- A one-line issue gets one sentence in one prose block. Do not pad it to match its neighbours.
- An issue the decision step settled as evident (one real option, `confidence: high`) gets one or two sentences and at most one short code excerpt, because its answer is plain once stated, whoever recorded the decision. Pictures and multi-part forms are for issues the reader must judge, even when a form's `when:` line matches the subject.
- An issue the owner cannot judge without background gets that background: how it works today, the terms it uses, the picture its subject calls for, the code with `file:line`.
- An issue with `origin` leads with the claim. The page already shows the whole quote; the explanation quotes only the individual parts it judges, each with its verdict and evidence, so the overall verdict on the page is earned.

**Option blocks.** Give an option its own `blocks` when choosing between the options needs more than the label, for example what each one produces: its output, its screen, its change to the code. Build them the same way across the options of one issue so they compare side by side. Otherwise leave `blocks` out.

**Block shape.** A block is `{ "form": "<form file name without .md>", ... }`; the other keys are the ones the form's file defines. A fold carries `label`, `size` and its inner `blocks`, and obeys section 4.

**Check and hand back.**

1. Write the file back as UTF-8 JSON.
2. Run `python <skills>/review/scripts/check_record.py <path to review.json> --stage ready`.
3. Fix every line it prints and run it again until it exits 0 with no output.
4. Tell the caller the record is ready, with one line per issue saying the shape you gave it (for example "issue 3: one sentence").

## 7. Self-check before handing over

- Is anything short folded? Is any fold missing its size?
- Is any term used before it is defined?
- Is any claim about code made without the code or a `file:line`?
- Is anything unverified stated somewhere other than at the claim?
- Do two issues of different weight look the same length or the same shape? Then one of them is padded or starved.
- Does the first sentence of each explanation give the answer?
