# Decision pages

A decision page shows a list of issues, lets the owner decide each one, and copies the decisions as text the agent reads back. The markup is written freehand from the review record (`review.json`, see the `review-page` skill's `references/record.md`). The behaviour is not: it comes from `assets/review-page.js`, pasted unchanged. The worked example is `assets/example-review-page.html`.

## What the page is for

The owner opens the page to do one job: answer the issues that need them, glance at what the agent settled, and copy the result. Everything on the page is ranked by that job:

1. **Which issues still wait for the owner, and how to reach the next one.** Always visible, in the sticky bar.
2. **The question, the recommendation and its one-line reason.** Enough to decide most issues.
3. **The options and their consequences.** Needed only when the owner disagrees.
4. **Background: explanation, worked numbers, code.** Needed only when the owner doubts the reasoning.
5. **Sources, confidence, "Not checked".** For auditing. Confidence and "Not checked" are also warning signals, so they stay visible; the source list folds.
6. **Agent-decided issues.** Skimmed, overruled now and then.

An earlier format gave all of these the same weight (every issue a fully open card, in record order, sources written out in full). Owners could not tell answered from unanswered issues and scrolled ten screens for three decisions. Keep the ranking.

## Paste the assets unchanged

- The published page has no `<!DOCTYPE>`, `<html>`, `<head>` or `<body>` tags: the Artifact tool adds the skeleton and the viewport. Drop them when publishing, even when you copied the worked example, which keeps them so it can be served for viewing.
- `assets/tokens.css` goes byte for byte into the first `<style>` of the page, after the `<title>` and font links. Page CSS goes in a second `<style>` after it.
- `assets/review-page.js` goes byte for byte into a `<script>` at the end of the page, after `#review-data`.
- Never edit, trim, reformat or wrap either one, and never add page-specific script. The script already drives the issue strip, the split progress, Next open issue, folding and every copy button; if the page needs a behaviour it does not have, build it with CSS (for example `:has()` and the `data-*` attributes below) or leave it out. The copied decision text must come from the shared script so the parser can read it.

## Page structure

1. **Page head**: title (`h1`), one muted line of context (what is reviewed, review round), and two or three sentences on how to use the page: how many issues need the owner, that the recommended option is preselected and counts once confirmed or changed, that the agent's issues are folded below and can be overruled, and to copy the decisions when done. When an issue has no recommendation (a preference question), say that a note alone answers it.
2. **Sticky bar**, left to right: the split progress (`[data-you-count]` over `[data-agent-count]`), the issue strip (one pill per issue, needs-owner pills first, a thin separator, then agent-decided pills), a spacer, **Next open issue** (`button[data-next]`) with an "All answered" message beside it that CSS shows instead once `body.all-done` is set, and **Copy decisions**. The bar wraps on narrow screens.
3. **`<main>`, in two sections, each opened by a small section heading**:
   - "Needs your decision" (with the count and "highest stakes first"): the needs-owner issues, open.
   - "Settled by the agent" (with the count and "open one to overrule it"): the agent-decided issues, folded to their verdict line by the script.
   Leave out a section that would be empty. Within each section keep the record's order (the review skill puts dependencies first, then stakes, and keeps the earlier order between issues of equal stakes); never re-sort on the page, or the copied text and the page disagree. When no issue needs the owner, the head says so ("None need you; confirm or change any of them"), only the agent section is shown, and the bar keeps Next open issue, which the script swaps for "All answered".
4. **The copied text**, under the issues: a `<details>` whose `<summary>` reads "What Copy decisions puts on your clipboard" and holds a second Copy decisions button (`button[data-copy]`), with the `<pre data-preview>` inside. The owner who just checked the text copies it from there.
5. `<script type="application/json" id="review-data">`, then the pasted script.

The order of `#review-data` must match the page order, so the copied text lists issues the way the owner saw them.

## Escaping record text

The record holds text from other people (a reviewer's quote, a ticket) and code excerpts full of `<T>`, `<Component>` and `&&`. Written raw into the page, it breaks the layout or injects markup.

- Every record string put into markup is escaped: `&` as `&amp;`, `<` as `&lt;`, `>` as `&gt;`, and inside attribute values also `"` as `&quot;`. That covers titles, quotes, explanation text, code lines, table cells, labels, reasons, sources, captions and `title` attributes.
- The only raw HTML on the page is a mockup block's `html`, which the agent writes itself. Never copy markup from `origin` or from sources into it.
- `#review-data` has its own rule, below.

## Issue anatomy

Every issue is an `<article id="issue-<id>" data-issue="<id>">` with the same parts in the same order. The `id` is needed for the strip, for parent links and for the `:has()` dependency rows.

1. **Header** (`.ih`): id badge, the title as `h2` with an `id` (`t<id>`) that the option group points to, and a fold toggle (`button[data-toggle]`, "Collapse" / "Details") at the right. Under the title:
   - **Badges**: one status badge per state, all written in the markup and shown by CSS from the `data-status` attribute the script sets (see the DOM contract): "Waiting for you", "Decided by you", "Agent decided", "Overruled by you", "Sent back to the agent". Then the **stakes pill** (`stakes.level`: High / Medium / Low, toned fail / warn / neutral; an older record without `stakes` takes it from a severity or impact attribute), "New in round N" when the issue was added or reworked in the current round (`issue.round` equals `review.round` and is above 1; issues from earlier rounds get no badge, or every issue on a round-3 page would carry one), and, on agent-decided issues, the confidence pill (so the owner sees a medium-confidence agent decision without unfolding it). Confidence always comes from `recommendation.confidence`; when an older record also has a "Confidence" attribute, leave that attribute out, so the page never shows two confidences for one issue.
   - **Facts line** (`.facts`, one muted line that wraps): "Why you:" (needs-owner issues only; agent-decided issues have no "Why you"), "Risk:" (`stakes.reason`), then the remaining attributes (reversibility, effort, owner) as short "Label: value" pairs joined by middle dots. Attributes are no longer chips: a row of six equal chips hides the two that matter.
   - The main `file:line`, when there is one, in `--font-mono` at the end of the facts line.
2. **Verdict line** (`[data-verdict]`): shown only while the issue is folded. The script fills `[data-vk]` (the chosen option's key), `[data-vl]` ("You chose …", "Agent chose …", "Preselected, not confirmed: …", "Sent back: …") and `[data-vo]` (the outcome). Leave the three spans empty in the markup.
3. **Detail** (`.detail`, everything below; hidden while folded):
   1. **Recommendation box** (`.recbox`), first, because it is what most decisions need: a line with "Recommended" (or "Agent's choice" on agent-decided issues), the option key and a short form of its label, and the confidence pill; the reason in one to three plain sentences (when the record's reason is longer, write its gist here and put the reason unchanged at the end of the background fold as "The agent's full reasoning", so nothing is lost); each `unverified` claim as its own warning row (`.unchk`, alert icon, "Not checked: …"); and the sources folded as "N sources" (`details.src`) listing short names with the full path or URL in a `title` attribute. Short names: a file is its name and lines (`StockLedger.cs:522-547`); a ticket or PR is its key (`S7C1-5255`, `PR 4456`); any other URL is its host and last path segment (`learn.microsoft.com/…/credit-memos`). For a pure preference question (`recommendation` is `null`) the box says "No recommendation: this is your preference." For a dependent issue it names the current parent answer and points to the dependency table.
   2. **Options**: `mode: radio` is a radio group (`role="radiogroup"`, `aria-labelledby` the title's id), one `<label class="opt">` per real option with its key, title, Recommended tag, a "Preselected, not confirmed" tag (`.pre`, shown by CSS only on the selected option of an undecided issue), the outcome line, option blocks and attribute rows. `mode: buttons` is one button per option (the real one first, then the dispute options); the real option's outcome, option blocks (a proposed reply, a one-line fix) and attribute rows go in a plain panel directly above the buttons, and the Recommended tag goes inside the real option's button, as in the worked example. Dependency rows keyed on a button issue use `:has(button[data-choice="<id>"][aria-pressed="true"])` instead of a checked radio. Dispute options of a radio issue sit as buttons under the radios.
   3. For a parent issue: a line linking to the dependent issue ("Issue 2 follows from this answer").
   4. **Background** (`details.bg`): the explanation blocks in the order the explainer gave them, each rendered as its form file says, behind a summary that names what is inside ("Background: where ValuationDate comes from, with the ticket's January example"). An `origin` quote with its verdict chip does not go into the background: it sits directly under the header, above the recommendation box, because a reviewer's claim is what the issue is about. When the quote is long (more than about five lines: a comment with code, alternatives or a list), show its first two or three sentences and fold the rest inside the quote panel as "Full comment, N lines", so the recommendation stays near the top. When the whole explanation is one or two sentences, write it inline under the recommendation box instead of folding it. A dependent issue's dependency panel stays inline too.
   5. A `[data-stale-notice]` holding a `use-recommendation` button (a dependent may place it in its dependency panel instead). Generic wording: "The agent's recommendation changed after you answered. Your answer is kept."
   6. **Foot** (`.foot`, top border): the note field, the status line (`.dstat`), and the action buttons: Confirm and Reopen on needs-owner issues, Restore the agent's choice on agent-decided ones, and on needs-owner issues a **Next open issue** button (`button[data-go-next]`) that CSS shows once the issue is answered.

Do not repeat the title as a question heading in the decision area: the title already is the question.

### Markup to start from

The fixed parts of every card, copied from the worked example. Change only the id, the texts and the stakes class (`high`, `med`, `low`); write the body between `.detail` and `.foot` freehand. On an agent-decided issue add the confidence pill after the stakes pill, drop "Why you" from the facts line, start the toggle with `aria-expanded="false"`, and replace the three buttons in `.state` with `<button type="button" class="btn ghost" data-act="restore">Restore the agent's choice</button>`.

```html
<article class="issue" id="issue-7" data-issue="7">
  <header class="ih"><span class="num">7</span><div class="ihc">
    <h2 id="t7">Customer email is written to the log at Information</h2>
    <div class="badges">
      <span class="st s-wait"><svg class="i" aria-hidden="true"><use href="#i-wait"/></svg>Waiting for you</span><span class="st s-you"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>Decided by you</span><span class="st s-agent"><svg class="i" aria-hidden="true"><use href="#i-agent"/></svg>Agent decided</span><span class="st s-over"><svg class="i" aria-hidden="true"><use href="#i-user"/></svg>Overruled by you</span><span class="st s-disp"><svg class="i" aria-hidden="true"><use href="#i-talk"/></svg>Sent back to the agent</span>
      <span class="stake med">Medium stakes</span>
    </div>
    <p class="facts"><b>Why you:</b> product decision<span class="dot">·</span><b>Risk:</b> personal data kept in the log for 90 days<span class="dot">·</span>Affects: support team<span class="dot">·</span><span class="where">src/Sync.Client/Import/OrderImporter.cs:88</span></p>
  </div><button type="button" class="toggle" data-toggle aria-expanded="true"><svg class="i" aria-hidden="true"><use href="#i-chev"/></svg><span class="t-close">Collapse</span><span class="t-open">Details</span></button></header>
  <div class="verdict" data-verdict><span class="vk" data-vk></span><span class="vt"><span data-vl></span> <span class="vo" data-vo></span></span></div>
  <div class="detail">
    <!-- origin quote, recommendation box, options, background fold, stale notice -->
    <div class="foot">
      <textarea data-note id="note-7" name="note-7" aria-label="Note to the agent for issue 7" placeholder="Note to the agent (optional; explain a different choice here)"></textarea>
      <div class="state">
        <span class="dstat"><span class="s-you"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>Decided by you.</span><span class="s-disputed"><svg class="i" aria-hidden="true"><use href="#i-talk"/></svg>Sent back to the agent. Your note tells it why.</span></span>
        <button type="button" class="btn primary" data-act="confirm"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>Confirm</button>
        <button type="button" class="btn ghost" data-act="reopen">Reopen</button>
        <button type="button" class="btn warn" data-go-next>Next open issue<svg class="i" aria-hidden="true"><use href="#i-next"/></svg></button>
      </div>
    </div>
  </div>
</article>
```

## `#review-data`

```html
<script type="application/json" id="review-data">
{ "review": { "id": "pr-2317-log-levels", "title": "PR #2317 \"Normalize log levels\"", "round": 2 },
  "issues": [ { "id": "1", "title": "...", "round": 1, "needsOwner": true, "mode": "radio",
                "options": [ { "id": "A", "label": "...", "dispute": false }, ... ],
                "recommended": "A", "agentChoice": null, "dependsOn": null,
                "decision": { "by": "owner", "choice": "B", "status": "decided" } } ] }
</script>
```

Build it from the record, one entry per issue, in page order:

| Data field | From the record |
|---|---|
| `review` | `review.id`, `review.title`, `review.round` |
| `id`, `title`, `round`, `needsOwner`, `mode`, `dependsOn` | the same issue fields |
| `options[]` | each option's `id`, `label`, `outcome` (when present) and `dispute` (`true` or `false`); leave out `attributes` and `blocks` |
| `recommended` | `recommendation.option`, or `null` when `recommendation` is `null` |
| `agentChoice` | `recommendation.option` when `needsOwner` is `false`, else `null` |
| `decision` | `{ by, choice, status }` from the issue's `decision` when `decision.by` is `owner`, else `null`. Leave out the note. |

- Copy `label` and `outcome` exactly as the record has them: they are copied into the decision text, and the parser matches them. Keeping them short is the record writer's job (`decide`); a long label is shown in full on the page and wraps.
- Escape every `<` inside the JSON with its JSON unicode escape, a backslash followed by `u003c` (every one, not only those in `</`), so no title, label or quote can end the script tag or open a comment. `JSON.parse` reads the escape back as `<`.
- The `id` of every issue and option must match the attributes in the markup exactly.

## DOM contract

The script finds everything through these attributes. Anything not listed is free markup.

| Element | Required | What the script does |
|---|---|---|
| `<script type="application/json" id="review-data">` | yes | Read once at load. Missing or invalid JSON: the script does nothing. |
| `article[data-issue="<id>"]` | yes, one per issue | After every change sets `data-state` (`undecided`, `decided`, `disputed`), `data-by` (`agent`, `owner` or empty), `data-needs` (`owner` or `agent`) and `data-status` (`wait`, `you`, `agent`, `over`, `disputed`; see below). Toggles class `collapsed`. Sets `hidden` when a filter excludes it. |
| `[data-verdict]` with `[data-vk]`, `[data-vl]`, `[data-vo]` inside | yes, one per issue | The texts are filled from the current choice. An article without `[data-verdict]` never folds. |
| `button[data-toggle]` | yes, one per issue | Folds or unfolds its article; `aria-expanded` follows. |
| `input[type=radio][name="opt-<id>"][value="<option id>"]` | radio issues | `checked` follows the state; picking one decides the issue as the owner (a dispute option makes it disputed). Toggles class `sel` on the closest `label` or `[data-option]`. |
| `button[data-choice="<option id>"]` | button issues; dispute options | Click chooses that option. `aria-pressed` follows the state. |
| `[data-rec-tag]` | recommended tag in each option | Shown only on the option that is recommended now. See nesting below. |
| `button[data-act="confirm"]` | needs-owner issues | Confirms the preselected choice, folds the issue and scrolls to the next one waiting. Shown only while the issue is undecided and has a choice. |
| `button[data-act="reopen"]` | needs-owner issues | Back to undecided with the recommendation preselected, and unfolds. Shown only on a needs-owner issue that is decided or disputed. |
| `button[data-act="restore"]` | agent-decided issues | Puts back the agent's choice. Shown only when the issue has an agent choice and the owner changed it. |
| `button[data-go-next]` | needs-owner issues | Folds its issue and scrolls to the next one waiting. Show it with CSS once the issue is answered. |
| `[data-stale-notice]` | yes, one per issue | Shown when the owner's kept decision is stale: its recommendation moved since the owner answered (a parent changed, or a republish changed it) and the kept choice differs from the new recommendation. The script sets `data-recommended="<option id>"` on it. |
| `button[data-act="use-recommendation"]` | inside the stale notice | Chooses the current recommendation. The script shows it whenever a recommendation exists, so it must sit inside `[data-stale-notice]`, which hides it. |
| `textarea[data-note]` | yes, one per issue | Typing saves the note; the value is restored on load. Give it an `id` and a `name` (`note-<id>`). |
| `a[data-pill="<id>"]` (with `href="#issue-<id>"`) | yes, one per issue, in the sticky bar | Its content is replaced by a status icon and the id; `data-status`, `title` and `aria-label` ("Issue 6, waiting for you: …") follow the state; `aria-current="true"` marks the issue last jumped to. Click scrolls to and unfolds the issue. Needs the sprite symbols `i-wait`, `i-check`, `i-agent`, `i-user`, `i-talk`. |
| `[data-you-count]` | yes | Text set to `You: <answered> of <needs-owner> answered`, or `Nothing needs you` when no issue needs the owner. A disputed issue counts as answered. |
| `[data-agent-count]` | when there are agent-decided issues | Text set to `Agent settled <n> · <m> overruled by you`. |
| `button[data-next]` | yes, in the sticky bar | Scrolls to the next issue waiting for the owner after the one at the top of the screen, wrapping round; when none waits, focuses Copy decisions. Keys `N` and `P` do the same forward and back, except while typing in a note. |
| `body.all-done` | set by the script | Present when no issue waits for the owner. Use it to swap Next open issue for "All answered" and to hide the per-issue Next buttons. |
| `button[data-copy]` | yes, one or more | Each copies the decision text. The clicked button's `[data-copy-label]` (or its own text, when it has no child elements) changes to "Copied" (or "Copy failed, select the text below") for 2.5 seconds. A copy button inside a `<summary>` does not open or close the fold. |
| `[data-preview]` | yes | Text set to the decision text after every change. When the clipboard is refused, the script opens a wrapping `<details>` and selects this element's text. |
| `[data-progress]` | optional | Text set to `<decided> of <total> decided` (agent decisions included). The split counts above replace it. |
| `button[data-filter="all\|needs\|agent\|new\|waiting"]` | optional | Click filters the articles; `aria-pressed` marks the active one. The two sections and the strip make filters unnecessary on most pages. |

Required nesting:

- **Recommended tag.** The script reads the option of a `[data-rec-tag]` from its closest `button[data-choice]`, `[data-option]` or `label`, and from a `label` it takes the value of the radio inside it. So put the tag and the radio inside the same `<label>`, or put both inside an element with `data-option="<option id>"`. A tag in a sibling element of the radio is never shown.
- **Selected option.** `.sel` goes on the closest `label` or `[data-option]` around the radio; style that element.
- **Hidden things.** The script hides through the `hidden` attribute. Your CSS must include `[hidden] { display: none !important }`.
- **Folding.** Put everything below the header except the verdict line in one wrapper (`.detail`) and hide it with `.issue.collapsed .detail { display: none }`; show `[data-verdict]` only under `.issue.collapsed`.
- **Issue scope.** Every control except the bar's pills, Next and Copy buttons must be inside its `article[data-issue]`; the script finds the issue from the closest article.

What `data-status` means, for CSS:

| `data-status` | When | Badge | Pill tone |
|---|---|---|---|
| `wait` | undecided | Waiting for you | warn |
| `you` | a needs-owner issue the owner answered | Decided by you | pass |
| `agent` | an agent decision the owner left | Agent decided | neutral |
| `over` | an agent decision the owner changed | Overruled by you | accent |
| `disputed` | a dispute option was picked | Sent back to the agent | fail |

Give a `wait` card a full `--warn-line` border with a soft `--warn-soft` outer ring, and give the preselected option of a `wait` card a dashed `--warn-line` border instead of the selected fill, so a preselection never looks like a decision.

## Folding

- On load the script folds every issue that is not waiting for the owner: agent decisions, and owner answers restored from this browser or the record. An issue named in the URL hash (`#issue-6`) stays open.
- Confirm and Next open issue fold the issue just answered and scroll to the next one waiting. Picking an option does not fold, so the owner can still compare options or add a note.
- Reopen unfolds. A strip pill unfolds the issue it jumps to.
- Folding is never stored: a reload shows waiting issues open and everything else folded.

## State, storage and the copied text

- Initial state: an agent-decided issue is decided, by the agent, with `agentChoice`. A needs-owner issue is undecided with its recommendation preselected, or nothing selected when there is none. An issue whose `decision` is set starts with the owner's decision instead, as if this browser had saved it in the issue's round, so a republished page keeps the record's owner decisions in a browser with no saved state.
- State is saved in `localStorage` under `review:<review.id>` after every change and restored on load (an owner answer saved in this browser wins over `decision`; a saved agent entry does not), so decisions survive a reload and a republish to the same link. Keep `review.id`, issue ids and option ids stable across rounds. Saved state for an id the page no longer has is ignored; a saved choice that no longer exists falls back to the recommendation. If a republish moves the recommendation of an issue the owner already decided, the owner's choice is kept; it is flagged stale (and the stale notice shows) only when that choice differs from the new recommendation.
- Rounds: every saved entry records the issue's `round`. When a republish raises an issue's `round` (the issue was reworked, for example after a dispute), its saved entry from the earlier round is ignored: the issue starts fresh, needs-owner issues undecided with the recommendation preselected, agent-decided issues decided by the agent, and the old note dropped (the agent already read it). A saved entry without a round counts as round 1. So to reopen a reworked issue, set its `round` to the new review round; to keep the owner's decision, leave its `round` as it was.
- The copied text is the format in the `review-page` skill's `references/decision-text.md`. Line breaks in titles, labels and outcomes become spaces; in notes they become ` / `.

## Counting

- Agent-decided issues count as decided from the start; the owner can overrule any of them.
- A needs-owner issue counts once the owner presses Confirm or picks any real option.
- Picking a dispute option (Reject, Discuss, Add the check anyway) marks the issue disputed: it is answered on the page but does not count as decided, and the copied text lists it under `Disputed:` so the agent re-thinks it. A note that disputes a decision is read by the agent from the text; the page does not detect it.
- The bar shows the owner's own progress (`You: 1 of 3 answered`) and, separately, the agent's (`Agent settled 4 · 0 overruled by you`). Never show one combined "4 of 7 decided" as the main count: it reads as progress the owner has not made.
- The owner can copy at any time; undecided issues are listed under `Undecided:`.

## Dependencies

When `dependsOn` is set, the recommendation of the dependent issue follows the parent's current choice through `dependsOn.map`.

- On the parent: a link line under its options, "Issue N follows from this answer. If you change it, the recommendation there changes with it."
- On the dependent, inline under its recommendation box (not in the background fold): a panel "Follows from issue M" with a table of the map: each parent answer, what is recommended here, and why (from `dependsOn.note` and the mapped option's `outcome`; when neither says why, leave the column out rather than invent a reason). Mark the row that applies now with CSS `:has()` on the parent's checked radio, for example `main:has(#issue-1 input[value="B"]:checked) #issue-2 tr[data-when="B"] { background: var(--accent-soft) }`.
- At the bottom of that panel: the `[data-stale-notice]` with a sentence ("You answered this before issue 1 changed. Your answer is kept; the Recommended tag shows what the agent suggests now.") and the `use-recommendation` button.
- A parent and its dependent can land in different sections (an agent-decided parent of a needs-owner dependent). That is fine: the link line and the panel name each other by number, and the strip reaches both.
- Behaviour, from the script: while the dependent is undecided, its preselected option and Recommended tag move with the parent. An agent-decided dependent follows the parent too: its choice becomes the option the map gives for the parent's current choice, and it stays decided by the agent. Once the owner decided it, the choice is kept; if it now differs from the new recommendation the stale notice appears.
- The copied text adds `Depends on: issue M = [<choice>] (confirmed|not confirmed)` under the dependent, or `Depends on: issue M = no choice yet (not confirmed)` when the parent has no choice (a parent with no recommendation that the owner has not answered).

## Before publishing

- Run `python <report-design>/scripts/check_page.py <page.html>` (from the review skill, `<skills>/report-design/scripts/check_page.py`). It checks the mechanical rules below and prints one problem per line; fix them all, then look at the page for the rest.
- `tokens.css` and `review-page.js` are present byte for byte, and no other script is on the page.
- `#review-data` parses, its order matches the page, and every issue and option id in it has its article, radio or button, and its strip pill.
- Each radio issue has its Recommended tag inside the option's `label`.
- Every issue states its recommendation's reason (or that there is none) in its recommendation box, every "Not checked" claim has its warning row, and every issue has a stale notice and a verdict line.
- Record text is escaped: a `<T>` from a code excerpt shows on the page as text, and `#review-data` holds no raw `<`.
- Open the page: waiting issues are open with a dashed preselection and agent issues folded; the counts read `You: 0 of N answered`; Confirm folds the issue and lands on the next waiting one; the strip pills change colour; both Copy buttons fill the clipboard and say "Copied"; light and dark both read well; the body does not scroll sideways at laptop or phone width.
