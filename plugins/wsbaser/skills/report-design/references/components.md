# Components

Rules for the parts every report page is made of. Write the markup and CSS freehand; these rules fix how the parts look and behave. The worked example for each is `assets/example-review-page.html` (the accepted review mockup rebuilt on the shared assets); class names below are the ones it uses, and you may name yours differently.

All colours, fonts and sizes come from the tokens in `assets/tokens.css` (`--page`, `--surface`, `--fg`, `--muted`, `--line`, `--accent`, `--warn-soft`, `--font-body`, `--fs-sm` and the rest). Never write a hex colour in page CSS except `#fff` for text on `--btn` or `--navy`; anything else breaks dark mode.

Every text that comes from the record or a source (titles, quotes, code lines, table cells, labels, reasons, captions) is HTML-escaped when it goes into markup: `&` as `&amp;`, `<` as `&lt;`, `>` as `&gt;`, and inside attribute values `"` as `&quot;`. A generic such as `Task<ImportResult>` in a code line is written `Task&lt;ImportResult&gt;` (issue 6 of the example). The only raw HTML is a mockup block's `html`, which the agent writes itself and never copies from `origin` or from sources.

## Page shell

- A page published with the Artifact tool has no `<!DOCTYPE>`, `<html>`, `<head>` or `<body>` tags: the tool adds the document skeleton and the viewport meta. Start the file with the two-to-four-word `<title>` and the `claude:viewport-fit-sides` meta, then the font links and the styles below. A local page served for viewing on its own (such as `assets/example-review-page.html`) keeps the full skeleton: `<!DOCTYPE html>`, `lang`, `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Fonts: Inter (400, 500, 600) and JetBrains Mono (400, 500, 600) from `fonts.googleapis.com`; the token stacks fall back to system fonts.
- First `<style>`, with or without the skeleton: `tokens.css` pasted unchanged. Second `<style>`: the page's own CSS.
- `body` (the CSS selector, which still applies when the tool adds the tag): `background: var(--page)`, `color: var(--fg)`, `font: 400 var(--fs-md)/1.55 var(--font-body)`, `font-variant-numeric: tabular-nums` so figures line up in tables and counters.
- Always include `[hidden] { display: none !important }`: component rules such as `display: grid` otherwise beat the `hidden` attribute, and the review script shows and hides things through it.
- Example: page head (`.top`) with an `h1` at `--fs-xl`, a muted sub-line, and one paragraph saying how to use the page.

## One reading column

- One column, `max-width: 1040px`, centred, side padding `max(16px, env(safe-area-inset-left, 0px))` and the same for the right (`.col`), so content clears a phone's side bar. Put `<meta name="claude:viewport-fit-sides" content="cover">` beside the `<title>`: the Artifact tool asks for both together, and this house style follows it rather than a plain 16px. No side panes, no master and detail, no stepper.
- The body never scrolls sideways at any width. Wide content (code, tables, pictures, mockups) scrolls inside its own frame with `overflow-x: auto`; give grid and flex children `min-width: 0` so they can shrink. Links and `<code>` in running text carry `overflow-wrap: anywhere`, so a long URL or path breaks instead of widening the page.
- Prose paragraphs are capped near `78ch`.
- Below 900px: two-column grids become one column, attribute rows drop to two columns, card padding shrinks to 16px.

## Sticky bar

- `position: sticky; top: env(safe-area-inset-top, 0px)`, background `--surface`, 1px `--line` borders top and bottom, a soft shadow below so it reads as floating, content in the same `.col` as the page.
- Holds, left to right: the split progress (owner's count in weight 600 over the agent's in `--fs-xs` `--muted`), the issue strip, a spacer, Next open issue (`.btn.warn`), the "All answered" message (hidden until `body.all-done`), Copy decisions (`.btn.primary`). Wraps on narrow screens; the strip wraps inside itself.
- On a decision page this is how the owner navigates. Give each issue `scroll-margin-top` larger than the bar (about 96px, 190px below 760px where the bar wraps) so a jump never lands under it.
- Example: `.bar`.

## Issue strip

- One pill per issue (`a.pill[data-pill]`): 28px high, fully rounded, `--font-mono` `--fs-xs` weight 600, a 12px status icon then the id. Needs-owner pills first, a 1px `--line-strong` separator, then agent-decided pills.
- Tone from `data-status`: `wait` `--warn-soft`/`--warn`/`--warn-line`, `you` `--pass-soft`/`--pass`, `agent` `--hover`/`--muted`, `over` `--accent-soft`/`--accent`, `disputed` `--fail-soft`/`--fail`. `aria-current="true"` adds a 2px `--accent-2` ring offset by the surface colour.
- The script writes the content, title and label; the markup is just `<a class="pill" href="#issue-6" data-pill="6"></a>`.

## Section headings

- Two sections in `<main>`: "Needs your decision" and "Settled by the agent". Each opens with a small heading row (`.sec`): the heading in `--fs-md`, uppercase, letter-spacing .06em, `--muted`, and a muted count line beside it ("3 issues · highest stakes first"). This is a label that names a real group, not a decorative eyebrow above a heading.

## Cards

- One card per issue: background `--surface`, 1px `--line` border, radius 12px, padding 20px 24px (16px on narrow screens), `display: grid; gap: 16px`.
- A card waiting for the owner (`[data-status="wait"]`) gets a full `--warn-line` border and a 3px `--warn-soft` outer ring; a disputed card a `--fail` border. Never a one-sided stripe.
- A card the script just scrolled to gets `.flash` for 1.2 seconds: a 3px `--accent-soft` ring.
- Folded (`.collapsed`): padding-block 16px, only the header and the verdict line show.
- Inside a card, evidence blocks are flat panels (background `--page`, 1px `--line`, radius 8px, no shadow). Never put a card inside a card, and never put a bordered panel inside a bordered panel, except a code frame inside a fold, which drops its own border, and a table or code frame inside the background fold, which keeps a `--surface` background.

## Header, badges and facts

- Issue header: a three-column grid: the id badge (`.num`: 28px high, at least 28px wide and growing for longer ids such as `35557-defect` up to about 12 characters, radius 8px, background `--navy`, 1px `--line-strong` border so it shows in dark mode, white `--font-mono` number), the title block, and the fold toggle at the right (below 760px the toggle drops under the title). The title is `h2` at `--fs-lg`.
- Under the title, one wrapping row of badges, then the facts line.
- Badges are fully rounded pills, `--fs-xs`, weight 600, 22px high. The status badge carries an icon and is shown by CSS from `data-status` (`wait` warn, `you` pass, `agent` neutral, `over` accent, `disputed` fail; all five are written in the markup). The stakes pill: High `--fail-soft`/`--fail`, Medium `--warn-soft`/`--warn`, Low `--hover`/`--muted`. The confidence pill is weight 500: neutral for high, warn for anything lower (medium-high, medium, low). "New in round N" uses `--accent-soft`/`--accent`.
- The facts line (`.facts`) is `--fs-sm` `--muted` running text: bold "Why you:" and "Risk:" labels in `--fg`, then the other attributes as "Label: value", joined by middle dots in `--faint`. Pick the attributes that matter for this issue; no fixed set.

## Verdict line

- `[data-verdict]`, shown only on a folded card: a flat panel (`--page`, 1px `--line`, radius 8px, 10px 12px padding), the option key in a small `--accent-soft` mono tag, then the script's text ("You chose …") and the outcome in `--muted`.

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

## Background fold

- On a decision page, each issue's explanation sits in one `<details class="bg">` under the options: a flat panel, the summary in `--accent` weight 500 with a chevron, naming what is inside ("Background: what negative stock is, with a worked example (Kaffi)"). Inside, the explanation's blocks in order, with 12px gaps.
- It may hold shorter content than the general fold rule allows, because the recommendation box above already carries the gist the owner decides on. When the whole explanation is one or two sentences, write it inline instead.
- Never fold an origin quote, a dependency panel, or anything the recommendation's reason refers to as "see below" without restating it.

## Sources fold

- `<details class="src">` at the end of the recommendation box: summary "N sources" in `--fs-xs` `--muted` with a chevron; a list of short source names in `<code>` (file name and lines, ticket key), the full path in a `title` attribute.

## Option radios

- Two or more real options: a radio group (`role="radiogroup"`, labelled by the question `h3`). Each option is one `<label class="opt">` containing its radio and everything about the option: a mono key letter, the title in weight 600, the Recommended tag, a one or two sentence description, any mockup or sample, and its attribute rows.
- Attribute rows are a `<dl class="attrs">` grid (`--cols` set per option group, two columns on narrow screens, one on phones): `dt` in `--fs-xs` `--muted`, `dd` in `--fs-sm`. Use the attributes that decide between these options, the same set on every option of the group.
- Each option is its own bordered row (1px `--line`, radius 10px, 6px gap between options), so options read as separate choices.
- Option titles and attribute values often hold paths and identifiers with no break points. Give `.ot`, the outcome line and `.attrs dd` `overflow-wrap: anywhere; min-width: 0`, and each `.attrs` cell `min-width: 0`; `overflow-wrap: break-word` on the body is not enough inside a flex or grid row, and the page then scrolls sideways on a phone.
- The selected option (`.sel`, set by the script on decision pages) gets `--accent-soft` and an `--accent-2` border. The recommended one carries a small tag (`.rec`: `--accent` text, 1px `--accent-2` border, check icon).
- On an issue still waiting for the owner, the preselected option is not yet a decision: give it a 1.5px dashed `--warn-line` border on `--surface` instead of the selected fill, and show its "Preselected, not confirmed" tag (`.pre`, `--warn`).
- Example: issues 1, 2, 7, 8, 9.

## Recommendation box

- Every issue opens its detail with a recommendation box (`.recbox`): `--accent-soft` background, a 1px border of `--accent-2` mixed 45% with transparent, radius 10px, 14px 16px padding, `overflow-wrap: anywhere` (a source URL has no break points).
- First line: "Recommended" (or "Agent's choice") as a small uppercase `--accent` label, the option key tag and a short form of the option in weight 600, the confidence pill. Then the reason in `--fs-sm` plain words, one to three sentences.
- Each claim the agent could not verify is its own warning row (`.unchk`): alert icon, "Not checked:" in weight 600, `--warn-soft` background, 1px `--warn-line` border, `--warn` text. Never a footnote and never merged into the reason.
- Then the sources fold.
- Agent-decided issues get the same box, so the owner can check the agent.
- Example: `.recbox` in every issue of the example; issue 2 shows the dependent form, naming the current answer and pointing to the table for the others.

## Verdict buttons

- One real option: a row of buttons (`.seg`) such as Accept / Reject / Discuss, labels chosen to fit the issue (Decline comment / Add the check anyway / Discuss for a comment judged not valid). Each button carries `aria-pressed`; the pressed one shows a check icon and its tone: yes `--pass-soft`/`--pass`, no `--fail-soft`/`--fail`, talk `--warn-soft`/`--warn`.
- Example: issues 3 to 6.

## Note field and status line

- Every issue has a note field: a `<textarea>` with an `id`, a `name`, an `aria-label` naming the issue, placeholder "Note to the agent (optional)" (on needs-owner issues "Note to the agent (optional; explain a different choice here)"), 36px high, resizable, background `--page`, 1px `--line-strong` border.
- Beside it, a short status line and the action buttons (Confirm primary with a check icon, Reopen and Restore ghost, Next open issue warn). The foot has a 1px `--line` top border. The status badge in the header already says "Waiting for you", so the foot does not repeat it.
- Example: `.foot` in every issue.

## Copied text

- Under the issues: `<details class="outd">`, `--surface`, radius 12px. Its summary holds a chevron, "What Copy decisions puts on your clipboard" (taking the free width) and a second Copy decisions button at the right. Inside, the `<pre data-preview>` in `--font-mono` 12px, `white-space: pre-wrap`.

## Filter buttons

- Optional on decision pages; the sections and the strip replace them. When used: a row of separate small buttons in the sticky bar, each with `aria-pressed` and a static count in a `<b>`. Pressed: `--accent-soft` background, `--accent-2` border, `--accent` text, weight 600.

## Buttons, focus and selection

- `.btn.primary`: background `--btn`, white text, hover darkened with `color-mix` toward `--navy` (`color-mix(in srgb, var(--btn) 80%, var(--navy))`), never toward a hex colour. `.btn.ghost`: `--surface` background, 1px `--line-strong` border. `.btn.warn` (Next open issue): `--warn-soft` background, 1px `--warn-line` border, `--warn` text.
- Focus ring on everything focusable: `:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px }`.
- Text selection: `::selection { background: var(--btn); color: #fff }`. Radios use `accent-color: var(--btn)`.
- Respect `prefers-reduced-motion`: no transitions, no smooth scrolling.

## Bans

- No nested cards.
- No coloured side borders thicker than 1px (no thick left stripe on cards, quotes or notices). The 2px inset on a highlighted code line is the only accent stripe.
- No unicode glyphs or emoji as icons. Icons are inline SVG (`<symbol>` sprite plus `<use>`), `aria-hidden="true"`, stroked with `currentColor`.
- No dimming or shrinking of agent-decided issues. They have the same anatomy and contrast as needs-owner issues; on a decision page they sit in their own section and start folded to a verdict line that states the agent's choice, one click from the full card.
- No content hidden behind a click unless it is a fold that meets the fold rule, the background fold, the sources fold, or a folded issue.
- No repeated question heading: the issue title is the question.
- No same-for-every-issue section grid: each issue's body has the blocks it needs and no others.
