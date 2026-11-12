---
when: the caller passes its own list of open points
---

# Issues supplied by the caller

The caller already knows what is open. Take its list as it is.

## Each point becomes one issue

| Field | Value |
|---|---|
| `id` | The caller's id when it matches `^[A-Za-z0-9-]+$`; otherwise `1`, `2`, ... in the caller's order. |
| `title` | The caller's wording. When a point runs over several lines, the first line is the title and the rest is context for the decision step. |
| `round` | The current `review.round`. |
| `origin` | The claim with its `quote`, `author` and `where` when the caller says the point is someone else's claim; otherwise `null`. |

- One point, one issue. Do not split, merge, reword or reorder the caller's points at intake; ordering is decided when the review is framed.
- Do not add issues of your own. The one exception is something blocking that the caller's list misses (the plan would break the build, lose data, or contradict a hard requirement): add it with `origin: null` and tell the caller you did.

## The review

- `review.id` and `review.title`: the caller's when given; otherwise derive them from the topic, `review.id` lower case and kebab-case.
- Pass whatever context the caller gave (conversation, files, links) to the decision step as pointers.
