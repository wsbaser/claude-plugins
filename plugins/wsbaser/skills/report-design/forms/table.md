---
when: several items compared on the same attributes, or every case of a condition
---

# Table

## When it fits

Use it when the reader compares: several items on the same attributes, every combination of a condition and its result, or what each answer to one issue means for another. Do not use it for one item with a few facts (use a sentence or attribute chips), or for options the owner chooses between (their attributes belong on each option, not in a separate table).

## How to build it

Block: `{ "form": "table", "caption": "...", "columns": ["If issue 1 is", "Recommended here", "Because"], "rows": [["A", "Information", "..."]], "align": ["left", "left", "left"] }`.

- Every row has a value in every column; write "none" or "n/a" rather than leaving a cell blank, unless blank means something the caption explains.
- Order rows so the answer stands out: the failing case first, the current case marked, or the total last.
- Numbers keep their units and real values.

Markup: a `<table>` inside a wrapper with border 1px `--line`, radius 8px, background `--page` and `overflow-x: auto`. Header cells `--fs-xs`, weight 500, `--muted`; body cells `--fs-sm`; 1px `--line` between rows. Numeric columns are right aligned with tabular numerals. A highlighted row (the case that applies now) uses background `--accent-soft`; a total row uses weight 600.

## On the page

Full column width, or narrower (`max-width`) when the table has two or three short columns. Wide tables scroll inside their wrapper, never the page. A table is never folded: the validator counts only text and code toward the fold minimum, and a table short enough to read is short enough to show.
