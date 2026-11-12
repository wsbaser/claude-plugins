---
when: extra depth of 600 characters or more that most readers will skip; never for short content
---

# Fold

## When it fits

A fold hides extra depth behind one click: a long full diff, multi-paragraph background, rejected options argued at length. Use it only when both are true: the content is 600 characters or more, and the reader can decide without it. Never fold content the decision depends on, and never fold short content, however minor: clicking to read two sentences is worse than reading them. An issue has at most a few folds.

## How to build it

Block: `{ "form": "fold", "label": "Full diff", "size": "48 lines", "blocks": [ ... ] }`.

- `label` names what is inside; `size` says how much, in the unit the reader feels: lines for code and diffs, paragraphs or words for text, rows for data.
- `blocks` holds ordinary blocks of other forms.
- The validator counts only the `text` and `code` fields inside a fold toward the 600 characters. Put long prose in `text` and long code or diffs in `code`; a fold holding only a table or a picture is rejected, so show those inline.
- Before folding, show the gist inline: one representative hunk above a folded full diff, one sentence above folded background.

On the page: `<details class="fold">` with a `<summary>` that shows a chevron icon (inline SVG, rotated 90 degrees when open), the label and the size, for example "Full diff, 48 lines". Summary text `--fs-sm`, weight 500, colour `--accent`; border 1px `--line`, radius 8px, background `--page`. Hide the default marker (`list-style: none` and `::-webkit-details-marker { display: none }`). A code frame inside loses its own border.

## On the page

Full column width, placed right after the inline gist it deepens. Closed by default. Never nest a fold inside a fold.
