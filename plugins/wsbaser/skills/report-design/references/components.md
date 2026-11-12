# Components

Rules for the parts every report page is made of. Write the markup and CSS freehand; these rules fix how the parts look and behave. The worked example for each is `assets/example-review-page.html` (the accepted review mockup rebuilt on the shared assets); class names below are the ones it uses, and you may name yours differently.

All colours, fonts and sizes come from the tokens in `assets/tokens.css` (`--page`, `--surface`, `--fg`, `--muted`, `--line`, `--accent`, `--warn-soft`, `--font-body`, `--fs-sm` and the rest). Never write a hex colour in page CSS except `#fff` for text on `--btn` or `--navy`; anything else breaks dark mode.

## Page shell

- `<!DOCTYPE html>`, `lang`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, a two-to-four-word `<title>`.
- Fonts: Inter (400, 500, 600) and JetBrains Mono (400, 500, 600) from `fonts.googleapis.com`; the token stacks fall back to system fonts.
- First `<style>`: `tokens.css` pasted unchanged. Second `<style>`: the page's own CSS.
- `body`: `background: var(--page)`, `color: var(--fg)`, `font: 400 var(--fs-md)/1.55 var(--font-body)`, `font-variant-numeric: tabular-nums` so figures line up in tables and counters.
- Always include `[hidden] { display: none !important }`: component rules such as `display: grid` otherwise beat the `hidden` attribute, and the review script shows and hides things through it.
- Example: page head (`.top`) with an `h1` at `--fs-xl`, a muted sub-line, and one paragraph saying how to use the page.

## One reading column

- One column, `max-width: 1040px`, centred, `padding-inline: 16px` (`.col`). No side panes, no master and detail, no stepper.
- The body never scrolls sideways at any width. Wide content (code, tables, pictures, mockups) scrolls inside its own frame with `overflow-x: auto`; give grid and flex children `min-width: 0` so they can shrink.
- Prose paragraphs are capped near `78ch`.
- Below 900px: two-column grids become one column, attribute rows drop to two columns, card padding shrinks to 16px.

## Sticky bar

- `position: sticky; top: 0`, background `--surface`, 1px `--line` borders top and bottom, content in the same `.col` as the page.
- Holds, left to right: filter buttons, a spacer, the progress text, the primary action (Copy decisions). Wraps on narrow screens.
- Example: `.bar`.

## Cards

- One card per issue or section: background `--surface`, 1px `--line` border, radius 12px, padding 24px 28px (16px on narrow screens), `display: grid; gap: 16px`.
- Inside a card, evidence blocks are flat panels (background `--page`, 1px `--line`, radius 8px, no shadow). Never put a card inside a card, and never put a bordered panel inside a bordered panel, except a code frame inside a fold, which drops its own border.

## Header, markers and chips

- Issue header: a small id badge (`.num`: 28px, radius 8px, background `--navy`, 1px `--line-strong` border so it shows in dark mode, white `--font-mono` number), the title as `h2` at `--fs-lg`, then one wrapping row of markers and chips, then the main `file:line` in `--font-mono`, `--fs-xs`, `--muted`.
- Markers say how the issue reaches the owner. They carry an inline SVG icon and weight 600: needs-owner (`.mark.needs`: `--warn-soft` background, `--warn` text, `--warn-line` border), agent-decided (`.mark.agent`: `--chip` background, `--accent` text), new in round N (`.mark.new`: `--accent-soft`, `--accent`, `--accent-2` border). Markers are the only visual difference between needs-owner and agent-decided issues.
- Chips are attributes: a free label and a value, `<span class="chip"><span class="cl">Risk:</span>low</span>`. Label in `--muted`, value in `--fg`, background `--hover`, `--fs-xs`, radius 6px. Pick the attributes that matter for this issue; no fixed set. Tone a chip only when the value is good or bad news: `.good` (`--pass-soft`/`--pass`), `.bad` (`--fail-soft`/`--fail`), `.warn` (`--warn-soft`/`--warn`).

## Origin quote with verdict

- When the issue starts from someone else's claim (a review comment, a ticket line): a panel (`.quote`) with the author in weight 600, where it points (`file:line` in `<code>`), a verdict chip pushed to the right (`Valid` good, `Not valid` bad, `Partly valid` warn), then the quote in quotation marks.
- The explanation that follows states the verdict's reason in its first sentence. Issues the agent found itself have no quote and no verdict.
- Example: issues 1 and 5.

## Evidence blocks

- Every claim about code shows the code or a `file:line`; every figure shows where it came from. Evidence sits directly under the sentence that makes the claim.
- Inline `<code>` for identifiers: `--font-mono`, background `--chip`, radius 4px, `overflow-wrap: anywhere`.
- Captions and asides: `.cap`, `--fs-sm`, `--muted`.

## Code with highlighted lines

- A `<figure class="code">`: caption bar with the file path left and a short note right (`--font-mono`, `--fs-xs`, `--muted`); a `<pre>` with one block `<span class="l">` per line, the real line number in `<span class="n">` (`--muted`, `user-select: none`).
- Highlighted lines: class `hl`, background `--warn-soft`, inset 2px left shadow in `--warn-line`. Highlight exactly the lines the prose names.
- Diffs use the same frame: gutter `<span class="g">` with `+`/`-`, added lines `--pass-soft`, removed `--fail-soft`, hunk headers `--muted`.
- The `<pre>` has `white-space: normal` and each line `white-space: pre`, so the newlines between line spans add no blank lines. Long lines scroll inside the `<pre>`.
- Two excerpts read against each other sit in a two-column grid (`.pair`). Example: issues 1, 3, 5, 6.

## Tables

- Wrapper with 1px `--line`, radius 8px, background `--page`, `overflow-x: auto` (`.tbl`). Header cells `--fs-xs`, weight 500, `--muted`; cells `--fs-sm`, 7px 12px padding, 1px `--line` between rows.
- Numbers right aligned (`.r`), totals weight 600, the row that applies now in `--accent-soft`.
- Example: worked numbers and the dependency table in issue 2.

## Figures

- Pictures are inline SVG or HTML/CSS inside `<figure class="fig">` (background `--page`, 1px `--line`, radius 8px, `overflow-x: auto`). Every SVG has `role="img"` and an `aria-label` that states what it shows in one sentence.
- SVG parts are coloured through classes that read tokens (`.bx`, `.hot`, `.bad`, `.ar`, `.pin`), never fixed colours. Text in SVG uses the body or mono font at 12px.
- A small proportion bar plus legend can replace a chart when one ratio is the point. Example: the flow in issue 1, the split bar in issue 8.

## Fold

- `<details class="fold">` with a `<summary>` holding a chevron SVG (rotates 90 degrees when open), the label and the size: "Full diff, 48 lines". The size is mandatory.
- Only for extra depth of 600 characters or more that the reader can decide without. Short content is never folded. Show the gist inline above the fold. Example: issue 6.

## Option radios

- Two or more real options: a radio group (`role="radiogroup"`, labelled by the question `h3`). Each option is one `<label class="opt">` containing its radio and everything about the option: a mono key letter, the title in weight 600, the Recommended tag, a one or two sentence description, any mockup or sample, and its attribute rows.
- Attribute rows are a `<dl class="attrs">` grid (`--cols` set per option group, two columns on narrow screens, one on phones): `dt` in `--fs-xs` `--muted`, `dd` in `--fs-sm`. Use the attributes that decide between these options, the same set on every option of the group.
- The selected option (`.sel`, set by the script on decision pages) gets `--accent-soft` and an inset 1px `--accent-2` ring. The recommended one is preselected and carries a small tag (`.rec`: `--accent` text, 1px `--accent-2` border, check icon).
- Example: issues 1, 2, 7, 8, 9.

## Recommendation

- Every recommendation shows its reason where the choice is made: a short block (`.why`) right under the decision question, `--fs-sm`, starting with "Recommended: <option>" in weight 600, then the reason in plain words, then a confidence chip and the sources (`file:line` in `<code>`, links). Agent-decided issues get it too, so the owner can check the agent.
- A claim the agent could not verify is said in this block, as its own sentence ("Not checked: ..."), in `--warn`. Never move it to a footnote.
- One line is enough when the reason is short. When the explanation above already argues the case, the reason still gets its one line here.
- Example: `.why` in issues 1, 7, 8 and 9.

## Verdict buttons

- One real option: a row of buttons (`.seg`) such as Accept / Reject / Discuss, labels chosen to fit the issue (Decline comment / Add the check anyway / Discuss for a comment judged not valid). Each button carries `aria-pressed`; the pressed one shows a check icon and its tone: yes `--pass-soft`/`--pass`, no `--fail-soft`/`--fail`, talk `--warn-soft`/`--warn`.
- Example: issues 3 to 6.

## Note field and status line

- Every issue has a note field: a `<textarea>` with a `name`, an `aria-label` naming the issue, placeholder "Note to the agent (optional)", 36px high, resizable, background `--page`, 1px `--line-strong` border.
- Beside it, a short status line and the action buttons (Confirm primary, Reopen and Restore ghost). Undecided status reads in `--warn`.
- Example: `.foot` in every issue.

## Filter buttons

- A row of separate small buttons in the sticky bar, each with `aria-pressed` and a static count in a `<b>`: All, Needs you, Agent decided, New this round. Pressed: `--accent-soft` background, `--accent-2` border, `--accent` text, weight 600.

## Buttons, focus and selection

- `.btn.primary`: background `--btn`, white text, hover darkened with `color-mix`. `.btn.ghost`: `--surface` background, 1px `--line-strong` border.
- Focus ring on everything focusable: `:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px }`.
- Text selection: `::selection { background: var(--btn); color: #fff }`. Radios use `accent-color: var(--btn)`.
- Respect `prefers-reduced-motion`: no transitions, no smooth scrolling.

## Bans

- No nested cards.
- No coloured side borders thicker than 1px (no thick left stripe on cards, quotes or notices). The 2px inset on a highlighted code line is the only accent stripe.
- No unicode glyphs or emoji as icons. Icons are inline SVG (`<symbol>` sprite plus `<use>`), `aria-hidden="true"`, stroked with `currentColor`.
- No dimming, shrinking, collapsing or reordering of agent-decided issues. They have the same anatomy, size and contrast as needs-owner issues; only the marker differs.
- No content hidden behind a click unless it is a fold that meets the fold rule.
- No same-for-every-issue section grid: each issue's body has the blocks it needs and no others.
