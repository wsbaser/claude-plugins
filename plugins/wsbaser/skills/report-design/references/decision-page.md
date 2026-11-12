# Decision pages

A decision page shows a list of issues, lets the owner decide each one, and copies the decisions as text the agent reads back. The markup is written freehand from the review record (`review.json`, see the `review` skill's `references/record.md`). The behaviour is not: it comes from `assets/review-page.js`, pasted unchanged. The worked example is `assets/example-review-page.html`.

## Paste the assets unchanged

- `assets/tokens.css` goes byte for byte into the first `<style>` in `<head>`. Page CSS goes in a second `<style>` after it.
- `assets/review-page.js` goes byte for byte into a `<script>` at the end of `<body>`, after `#review-data`.
- Never edit, trim, reformat or wrap either one, and never add page-specific script. If the page needs a behaviour the script does not have, build it with CSS (for example `:has()` and the `data-state` attributes below) or leave it out. The copied decision text must come from the shared script so the parser can read it.

## Page structure

1. Page head: title (`h1`), one muted line of context (what is reviewed, review round, issue count), one paragraph on how to use the page.
2. Sticky bar: filter buttons, progress text, Copy decisions.
3. `<main>`: one `<article>` per issue, in the order the review chose, all fully visible.
4. A preview section under the issues: "What Copy decisions puts on your clipboard" and a `<pre data-preview>`. Keep it visible, not folded.
5. `<script type="application/json" id="review-data">`, then the pasted script.

## Issue anatomy

Every issue has the same three parts, whether the agent decided it or the owner must:

1. **Header** (`<article id="issue-<id>" data-issue="<id>">`; the `id` is needed for parent links and for the `:has()` dependency rows): id badge, title (`h2`, the record's `title`), then one row of markers and chips, then the main `file:line`.
   - A small marker: "Needs you" (needs-owner) or "Agent decided", plus "New in round N" when `issue.round > 1` (N is `issue.round`; the copied text marks the same issues).
   - Chips for the issue's `attributes` (label and value), and for a needs-owner issue its reason ("Why you: costly to reverse").
2. **Body**: the explanation blocks in the order the explainer gave them, each rendered as its form file says. An `origin` comes first as a quote with its verdict chip. The body of a simple issue may be one sentence; never pad it to match the others.
3. **Decision block** (`.decide`, separated by a 1px top border):
   - The question as `h3`.
   - **Recommendation** (`.why`), directly under the question: which option the agent recommends and why, from the record's `recommendation`: the `reason` in plain words, the `confidence` as a chip, the `sources` as links or `file:line` in `<code>`. Each `unverified` claim is stated in the same place, as a sentence that says what was not checked. One line is enough when the reason is short; never leave it out, also not on agent-decided issues. For a pure preference question (`recommendation` is `null`) say so: "No recommendation: this is your preference." For a dependent issue, the reason for each parent answer is in the dependency table and this line names the current one.
   - `mode: radio`: a radio group, one `<label>` per real option with its title, Recommended tag, description, option blocks and attribute rows. `mode: buttons`: one button per option (the real one first, then the dispute options).
   - Dispute options of a radio issue, if any, as buttons under the radios.
   - For a parent issue: a line linking to the dependent issue ("Issue 2 follows from this answer").
   - A `[data-stale-notice]` holding a `use-recommendation` button, on every issue (a dependent issue may place it in its dependency panel instead). Generic wording: "The agent's recommendation changed after you answered. Your answer is kept." The script shows it only when needed.
   - The note field, the status line, and the action buttons: Confirm and Reopen on needs-owner issues, Restore the agent's choice on agent-decided ones.

## `#review-data`

```html
<script type="application/json" id="review-data">
{ "review": { "id": "pr-2317-log-levels", "title": "PR #2317 \"Normalize log levels\"", "round": 2 },
  "issues": [ { "id": "1", "title": "...", "round": 1, "needsOwner": true, "mode": "radio",
                "options": [ { "id": "A", "label": "...", "dispute": false }, ... ],
                "recommended": "A", "agentChoice": null, "dependsOn": null } ] }
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

- Write `label` and `outcome` short and on one line: they are copied into the decision text.
- Escape `</` as `<\/` inside the JSON so a title or label cannot end the script tag.
- The `id` of every issue and option must match the attributes in the markup exactly.

## DOM contract

The script finds everything through these attributes. Anything not listed is free markup.

| Element | Required | What the script does |
|---|---|---|
| `<script type="application/json" id="review-data">` | yes | Read once at load. Missing or invalid JSON: the script does nothing. |
| `article[data-issue="<id>"]` | yes, one per issue | Sets `data-state` (`undecided`, `decided`, `disputed`) and `data-by` (`agent`, `owner` or empty) on it after every change; sets `hidden` when the filter excludes it. |
| `input[type=radio][name="opt-<id>"][value="<option id>"]` | radio issues | `checked` follows the state; picking one decides the issue as the owner (a dispute option makes it disputed). Toggles class `sel` on the closest `label` or `[data-option]`. |
| `button[data-choice="<option id>"]` | button issues; dispute options | Click chooses that option. `aria-pressed` follows the state. |
| `[data-rec-tag]` | recommended tag in each option | Shown only on the option that is recommended now. See nesting below. |
| `button[data-act="confirm"]` | needs-owner issues | Confirms the preselected choice. Shown only while the issue is undecided and has a choice. |
| `button[data-act="reopen"]` | needs-owner issues | Back to undecided with the recommendation preselected. Shown only on a needs-owner issue that is decided or disputed. |
| `button[data-act="restore"]` | agent-decided issues | Puts back the agent's choice. Shown only when the issue has an agent choice and the owner changed it. |
| `[data-stale-notice]` | yes, one per issue | Shown when the owner's kept decision is stale: its recommendation moved since the owner answered (a parent changed, or a republish changed it) and the kept choice differs from the new recommendation. The script sets `data-recommended="<option id>"` on it. |
| `button[data-act="use-recommendation"]` | inside the stale notice | Chooses the current recommendation. The script shows it whenever a recommendation exists, so it must sit inside `[data-stale-notice]`, which hides it. |
| `textarea[data-note]` | yes, one per issue | Typing saves the note; the value is restored on load. Give it a `name` (`note-<id>`). |
| `[data-progress]` | yes | Text set to `<decided> of <total> decided`. |
| `button[data-copy]` | yes | Copies the decision text. If it contains `[data-copy-label]`, that element's text changes to "Copied" (or "Copy failed, select the text below") for 2.5 seconds; otherwise the button's own text does, but only when it has no child elements. |
| `[data-preview]` | yes | Text set to the decision text after every change. When the clipboard is refused, the script opens a wrapping `<details>` if there is one and selects this element's text. |
| `button[data-filter="all\|needs\|agent\|new"]` | yes | Click filters the articles; `aria-pressed` marks the active one. `needs` = `needsOwner`, `agent` = not `needsOwner`, `new` = `issue.round` equals `review.round`. Counts in the buttons are static text you write. |

Required nesting:

- **Recommended tag.** The script reads the option of a `[data-rec-tag]` from its closest `button[data-choice]`, `[data-option]` or `label`, and from a `label` it takes the value of the radio inside it. So put the tag and the radio inside the same `<label>`, or put both inside an element with `data-option="<option id>"`. A tag in a sibling element of the radio is never shown.
- **Selected option.** `.sel` goes on the closest `label` or `[data-option]` around the radio; style that element.
- **Hidden things.** The script hides through the `hidden` attribute. Your CSS must include `[hidden] { display: none !important }`.
- **Issue scope.** Every control must be inside its `article[data-issue]`; the script finds the issue from the closest article. Give each article `id="issue-<id>"` when you use parent links or the `:has()` dependency rows.

Optional hooks the script provides for CSS:

- `article[data-state][data-by]`: show one status line per state, for example "Waiting for you" when `undecided`, "Decided by the agent" when `decided` and `agent`, "Decided by you" or "Overruled by you" when `decided` and `owner`, "Sent back to the agent" when `disputed`.
- `[data-stale-notice][data-recommended]`: the option now recommended.

## State, storage and the copied text

- Initial state: an agent-decided issue is decided, by the agent, with `agentChoice`. A needs-owner issue is undecided with its recommendation preselected, or nothing selected when there is none.
- State is saved in `localStorage` under `review:<review.id>` after every change and restored on load, so decisions survive a reload and a republish to the same link. Keep `review.id`, issue ids and option ids stable across rounds. Saved state for an id the page no longer has is ignored; a saved choice that no longer exists falls back to the recommendation. If a republish moves the recommendation of an issue the owner already decided, the owner's choice is kept; it is flagged stale (and the stale notice shows) only when that choice differs from the new recommendation.
- Rounds: every saved entry records the issue's `round`. When a republish raises an issue's `round` (the issue was reworked, for example after a dispute), its saved entry from the earlier round is ignored: the issue starts fresh, needs-owner issues undecided with the recommendation preselected, agent-decided issues decided by the agent, and the old note dropped (the agent already read it). A saved entry without a round counts as round 1. So to reopen a reworked issue, set its `round` to the new review round; to keep the owner's decision, leave its `round` as it was.
- The copied text is the format in the `review` skill's `references/decision-text.md`. Line breaks in titles, labels and outcomes become spaces; in notes they become ` / `.

## Counting

- Agent-decided issues count as decided from the start; the owner can overrule any of them.
- A needs-owner issue counts once the owner presses Confirm or picks any real option.
- Picking a dispute option (Reject, Discuss, Add the check anyway) marks the issue disputed: it is answered on the page but does not count as decided, and the copied text lists it under `Disputed:` so the agent re-thinks it. A note that disputes a decision is read by the agent from the text; the page does not detect it.
- The progress text reads `<decided> of <total> decided`. The owner can copy at any time; undecided issues are listed under `Undecided:`.
- Say this in the page head paragraph so the owner knows what counts.

## Dependencies

When `dependsOn` is set, the recommendation of the dependent issue follows the parent's current choice through `dependsOn.map`.

- On the parent: a link line under its options, "Issue N follows from this answer. If you change it, the recommendation there changes with it."
- On the dependent, in its body: a panel "Follows from issue M" with a table of the map: each parent answer, what is recommended here, and why. Mark the row that applies now with CSS `:has()` on the parent's checked radio, for example `main:has(#issue-1 input[value="B"]:checked) #issue-2 tr[data-when="B"] { background: var(--accent-soft) }`.
- At the bottom of that panel: the `[data-stale-notice]` with a sentence ("You answered this before issue 1 changed. Your answer is kept; the Recommended tag shows what the agent suggests now.") and the `use-recommendation` button.
- Behaviour, from the script: while the dependent is undecided, its preselected option and Recommended tag move with the parent. Once the owner decided it, the choice is kept; if it now differs from the new recommendation the stale notice appears.
- The copied text adds `Depends on: issue M = [<choice>] (confirmed|not confirmed)` under the dependent, or `Depends on: issue M = no choice yet (not confirmed)` when the parent has no choice (a parent with no recommendation that the owner has not answered).

## Before publishing

- `tokens.css` and `review-page.js` are present byte for byte.
- `#review-data` parses, and every issue and option id in it has its article, radio or button.
- Each radio issue has its Recommended tag inside the option's `label`.
- Every issue states its recommendation's reason (or that there is none), and every issue has a stale notice.
- Open the page: the preselected options and tags are right, progress reads as expected, Copy decisions fills the preview, light and dark both read well, and the body does not scroll sideways at laptop or phone width.
