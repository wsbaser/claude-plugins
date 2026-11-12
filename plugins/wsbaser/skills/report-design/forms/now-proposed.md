---
when: a behaviour or structure changes; show today first, then the proposal beside it
---

# Now and proposed

## When it fits

Use it when a design changes: a class split, a new step in a flow, a different message shape, a changed log line. The reader must understand today's behaviour before judging the change, so today always comes first. Do not use it for a small code change that a diff shows completely, or when there is nothing today (a new feature): then show the proposal alone.

## How to build it

Block: `{ "form": "now-proposed", "now": [ ...blocks ], "proposed": [ ...blocks ], "changes": ["Session owns the Error", "Transport drops to Debug"] }`.

- `now` and `proposed` each hold ordinary blocks of other forms (a sentence, a code excerpt, a small flow), built the same way on both sides so the eye can compare them line for line.
- `changes` lists the differences in a few words each. When the sides are pictures, number the differences with pins on the proposed side and give the list as the pin legend.
- When there are several proposals, the current state is shown once in the explanation and each proposal sits in its own option.

On the page: a two-column grid (`grid-template-columns: repeat(2, minmax(0, 1fr))`, gap 12px), "Now" on the left and "Proposed" on the right, each headed by a small label (`--fs-xs`, weight 600, `--muted` for Now, `--accent` for Proposed). The columns use the same blocks at the same scale. Below 900px the grid becomes one column with Now on top.

## On the page

Full column width. Neither side is folded; if one side is too long to show, show less of it on both sides.
