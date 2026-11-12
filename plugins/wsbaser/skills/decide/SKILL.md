---
name: wsbaser:decide
description: Decides open issues the way a careful senior would — sizes research to each issue, consults the installed skill that fits its kind, picks the best option with reasons and sources, and marks only the issues that truly need the owner. Takes a review.json and fills in options, recommendations and agent decisions. Use from wsbaser:review, or whenever a list of open questions should be settled with as few questions to the user as possible.
---

# Decide

Take a list of open issues, decide each one the way a careful senior would, and ask the owner only where it is justified. Spend effort where the stakes are: an evident issue costs a sentence, an important one gets research and the fitting skill.

You build no page and write no prose for the reader beyond reasons. Explaining each issue is another skill's job.

In this file, `<skills>` is the plugin's skills folder: the parent of this skill's base directory, where the sibling skills used below live.

## Input and output

The caller gives you the path to a `review.json` and, often, pointers to what it already knows: the conversation, files, links. Read those pointers; they are part of each issue's context.

1. Read `<skills>/review/references/record.md`. Its field names are the contract. If it or `<skills>/review/scripts/check_record.py` is missing, stop and tell the caller.
2. Run `python <skills>/review/scripts/check_record.py <path to review.json> --stage intake`. If it prints anything, stop, write nothing, and tell the caller what it printed.
3. Decide every issue that has no `options` yet, and any issue the caller names for a re-think. Leave the others as they are. In a later round the caller may pass a list of issue ids to (re)work; then work only on those and leave every other issue untouched. Without a list, work on every issue.

For each issue you decide, fill exactly these fields:

- `kind`: the name of the kind file that matched (without `.md`), or the free text from triage when no file matched.
- `attributes`, `mode`.
- `options`: each with `id`, `label` and `attributes`, plus `outcome`, `dispute` and `blocks` where section 6 and the kind file say.
- `recommendation`: `option`, `reason`, `confidence`, `sources`, `unverified`.
- `needsOwner` and `needsOwnerReason` (an empty string when `needsOwner` is `false`).
- `dependsOn`: `null` or the parent with its map.
- `origin.verdict` and `origin.verdictReason`, when the issue has an `origin`.
- `decision`, which follows `needsOwner`. `needsOwner: false`: `{ "by": "agent", "choice": <recommended option id>, "note": "", "status": "decided" }`. `needsOwner: true`: `{ "by": null, "choice": null, "note": "", "status": "undecided" }`, even when a recommendation is set.

Leave `id`, `title`, `round`, the origin's `quote`, `author` and `where`, `explanation` and the `review` object unchanged.

## 1. Triage every issue first, in the main thread

Before any research, go through the whole list and note per issue:

- **Kind**: free text naming what sort of question it is, in a few words.
- **Stakes**: what goes wrong, and for whom, if the choice is wrong.
- **Cost of reversal**: a one-commit revert, or a migration, a breaking change, a message to customers.
- **Is the answer evident?** From code you can read in a minute, or from the conversation. Often it is.

Triage is cheap and shapes everything after it. Reading a file in the repository to see whether the answer is evident is part of triage; research outside the repository is not.

## 2. Load kind guidance

A kind file says how to decide one kind of issue: its signals, what to research, which skill to consult, and what every option must come with. Kinds live in a slot, one file per kind, each opening with a `when:` line. The set grows by adding files, so never assume which kinds exist: list them.

1. List `kinds/` in this skill and, if it exists, `.claude/review/kinds/` under the root of the project being worked on.
2. Read only the frontmatter `when:` line of each file. When both folders hold a file with the same name, the project's file replaces the plugin's.
3. Load only the files whose `when:` matches an issue on your list. One issue can match more than one.

For an issue no kind file matches, look through the installed skill list and pick the one whose description fits the issue, or none. If a skill a kind file names is not installed, decide without it and say so in the reason.

## 3. Size the effort per issue

| The issue is | Do |
|---|---|
| Evident | Decide now. No research, no skill. |
| A local question | Read the code that answers it. No web search. |
| In need of outside knowledge (best practice, library behaviour, a convention, domain rules) | Research on the web, scaled to the stakes: one or two sources for a cheap choice, more for a costly one. |
| Important (high stakes or costly to reverse) | Both: the research and the skill the kind file names. |

When a loaded kind file says to consult a skill, consult it for every issue of that kind that is not evident, and always for an important one. The kind file governs; the table is the floor.

Stop researching when the pick is clear or when more sources stop changing it.

## 4. Use subagents economically

Never one subagent per issue. Decide in the main thread what you can, and send the rest out in as few subagents as the work allows.

- **Inline:** evident issues and local questions answered by one or two files you already have open.
- **Batched:** issues that touch the same code, share a research question, or need the same skill go to one subagent together.
- **Alone:** a heavy issue (wide web research plus a skill, or a trace across several repositories) gets its own subagent.
- **In parallel:** launch every independent subagent in one message. For a list of under ten issues, zero to three subagents is typical. For ten or more, batch by shared code or shared skill; rarely more than four subagents.

Each subagent brief names:

- the issue ids and titles, and each origin's `quote` and `where`;
- what triage already found: the kind, the stakes, the files read with `file:line`;
- the kind file to follow (its path) and the skill to consult, if any;
- how deep to research;
- paths with `<skills>` already replaced by the real folder; a subagent does not know what `<skills>` means;
- the fields to return per issue: options with labels and attributes, the recommended option with reason, confidence, sources and unverified claims, and the verdict with its reason for an issue with an origin.

Subagents return data. Only the main thread writes `review.json`.

## 5. Judge claims first

An issue with an `origin` started as someone else's claim. Before building options, judge the claim against the code and the facts:

- `valid`: the claim holds.
- `not-valid`: it does not; for example, what it asks for already exists.
- `partly`: some of it holds; say which part.

Write `verdictReason` with the evidence, `file:line` where it is code. A `not-valid` claim is still an issue: its one real option declines it (for example id `decline`). The recommendation's reason opens with the evidence-based reply to whoever made the claim, and that same evidence is why declining beats doing it: "The guard already exists at `orders.py:9`, two lines above; a second one would be dead code."

## 6. Build options and pick

- **One real option** (the answer is clear and there is nothing real to weigh it against): `mode: "buttons"`. Add dispute options that fit the issue, each with `"dispute": true`: for example `reject` ("Leave it as is") and `discuss`; for a declined claim, "Do it anyway" and `discuss`.
- **Several real options**: `mode: "radio"`, usually two or three. Never add a weak option to make a choice look fair.
- Each option's `label` says what it does. Add `outcome` when the copied decision text needs a short statement of what choosing it does.
- The `attributes` on each option are the ones that matter for this issue, as the kind file says. Issue-level `attributes` carry what applies to the whole issue, such as confidence or severity.
- Write option `blocks` only where the kind file asks for them.
- Pick the best option on the evidence. The `reason` says why it beats the others, in one or two sentences. When a skill's advice shaped the pick, name the skill in the reason.

## 7. Decide whether to ask

Apply `references/ask-rule.md`. It alone says when `needsOwner` is `true` and how to word `needsOwnerReason`. Read it every run; it changes.

Two cases on a re-think come before the ask rule, because the owner has already spoken:

- **The owner disputed the choice.** When the re-think keeps the choice the owner disputed, set `needsOwner: true` with `needsOwnerReason: "owner disputed in round <N>"`, N being the round the owner disputed in: one less than `review.round`, which the caller raised before calling you. Only the owner settles a dispute the agent did not give way on.
- **The owner answered in a note** on an undecided issue. Map the note to an existing option, or add the owner's answer as a new real option; recommend that option and set `needsOwner: true` with a reason that says the answer came from the owner's note, so the owner confirms it on the page.

## 8. Find dependencies

An issue depends on another when its best answer changes with the other's answer. For each such pair:

- Set `dependsOn` on the child: `{ "issue": "<parent id>", "map": { ... }, "note": "<what changes>" }`.
- The map has a key for every option of the parent, dispute options included, and each value is an option of the child.
- The value for the parent's recommended option is the child's recommendation. Every other real parent option maps to the child option that is best if the owner picks it. Each dispute option of the parent maps to the child's recommendation: a disputed parent leaves the child as it is.
- When the parent needs the owner, so does the child: `needsOwner: true`, `needsOwnerReason: "follows issue <parent id>"`, decision undecided, so the owner confirms the pair together. The page moves the child with the parent's answer either way; an agent-decided child follows the map and stays decided by the agent.
- No loops. When an issue seems to depend on two others, pick the one that decides it.

## 9. Record honestly

- Every claim traces to something you read. `sources` lists links and `file:line` references.
- Cite only pages you opened. A claim taken from a search-result summary goes in `unverified`, marked "from search summaries, pages not opened", and its links stay out of `sources`.
- What you could not verify goes in `recommendation.unverified`, one claim per entry.
- `confidence` is one short word (`high`, `medium`, `low`) that matches what you found.

## 10. Validate and hand back

1. Write the file back as UTF-8 JSON.
2. Run `python <skills>/review/scripts/check_record.py <path to review.json> --stage decided`.
3. Fix every line it prints and run it again until it exits 0 with no output. After three rounds that still print errors, stop and give the caller the remaining lines.
4. Tell the caller the record is decided, with how many issues the agent decided, which ids need the owner, and the reason for each.
