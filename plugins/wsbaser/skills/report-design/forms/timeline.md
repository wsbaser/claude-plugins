---
when: two or more actors and the outcome depends on ordering, including the ordering that fails
---

# Timeline

## When it fits

Use it for races, retries, concurrent requests, caches that expire between two reads: anything where the result depends on who acts first. Always show the ordering that fails, next to or instead of the one that works; a race explained only by its happy path explains nothing. Do not use it for a single actor passing a value through layers (use a flow).

## How to build it

Block: `{ "form": "timeline", "caption": "...", "lanes": ["Request A", "Request B", "Database"], "events": [ { "lane": 0, "at": 1, "label": "reads stock = 5" }, { "lane": 1, "at": 2, "label": "reads stock = 5" }, { "lane": 0, "at": 3, "label": "writes 4" }, { "lane": 1, "at": 4, "label": "writes 4", "bad": true } ], "result": "one sale is lost" }`.

- One lane per actor, named the way the code names it.
- `at` is the order of events, not real time; equal values mean "at the same moment".
- Mark the event where the outcome goes wrong with `bad: true`, and give the outcome in `result`.
- When the fix changes the order, add a second timeline with the fixed order rather than describing it.

On the page: an inline SVG (`role="img"`, caption as `aria-label`) in `<figure class="fig">`. Lanes are horizontal rows with the actor name at the left (`--font-body` 12px, weight 500) and a thin `--line-strong` track. Events are small rounded boxes on their lane (`--surface` fill, `--line-strong` stroke); a bad event fills `--fail-soft` with a `--fail` stroke; arrows between lanes are `--muted`. The result sits at the right end in `--fail`. Use CSS classes that read tokens, not fixed hex.

## On the page

Full column width, `width: 100%; height: auto`, minimum width about 640px, scrolling inside its figure on a narrow screen. Failing and fixed orderings stack vertically with a one-line caption each. Never folded.
