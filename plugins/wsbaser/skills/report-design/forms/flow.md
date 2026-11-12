---
when: a value or request passes through steps or layers and the order matters
---

# Flow

## When it fits

Use it for a data path or a request path: where a value starts, which layers touch it, where it goes wrong. It answers "where does this happen" at a glance. Do not use it when two or more actors act at the same time and timing decides the outcome (use a timeline), or for a path of two steps (a sentence is enough).

## How to build it

Block: `{ "form": "flow", "caption": "...", "steps": [ { "label": "HttpSyncTransport", "detail": "LogError, then throws", "where": "HttpSyncTransport.cs:68", "mark": "hot" } ] }`.

- Steps in order, each with a short `label` (the component or layer), a `detail` (what it does to the value), and `where` (`file:line`) when it is code.
- `mark` is optional: `hot` for the steps the issue is about, `bad` for the wrong result. Mark the hot steps with numbered pins when the prose refers to them by number.
- `caption` is one plain sentence describing the whole path; it becomes the picture's `aria-label`.

Markup: an inline SVG with `role="img"` and the caption as `aria-label`, inside `<figure class="fig">` (background `--page`, border 1px `--line`, radius 8px). Boxes are rounded rectangles: normal steps fill `--surface`, stroke `--line-strong`; hot steps fill `--warn-soft`, stroke `--warn-line`; the bad result fills `--fail-soft`, stroke `--fail`. Arrows are 1.5px `--muted` lines with small heads. Labels use `--font-body` 12px in `--fg`, details in `--muted`, code names in `--font-mono`. Pins are small `--warn` circles with the number in `--surface` (white fails contrast on the dark-mode `--warn`). Colour every SVG part through CSS classes that read tokens, never fixed hex, so dark mode works.

## On the page

Full column width, `width: 100%; height: auto`. A flow of four steps or more is laid out left to right with a minimum width (about 760px) and scrolls inside its figure on a narrow screen; the page itself never scrolls sideways. A flow is never folded.
