---
when: money, rounding, costing or any rule best shown with real figures
---

# Worked numbers

## When it fits

Use it when the reader has to trust a figure: a cost, a rounding rule, a volume estimate, "why is it 171,600". Real numbers carried step by step convince where a formula in words does not. Do not use it for one number with an obvious source (put it in the sentence), or for comparing options (put the figure on each option).

## How to build it

Block: `{ "form": "worked-numbers", "caption": "Worked numbers, last rollout", "rows": [ { "label": "On-prem installs", "value": "340", "source": "licence report, October" }, { "label": "Clients behind: 340 × 0.12", "value": "41" }, { "label": "Warning lines per day: 41 × 2,880", "value": "118,080", "total": true } ], "plain": "About 118,000 extra lines a day reach central telemetry." }`.

- Each row is one step: the label states the operation with its inputs (`340 × 0.12`), the value is the result, the source says where an input came from (a report, a setting, `file:line`).
- Use the real figures from the code, the data or the ticket, with units and thousands separators. Say in `source` when a figure is an estimate.
- `total: true` marks the result row. `plain` is one sentence in plain words that says what the result means.
- When explaining "why this value", add rows for candidate formulas and show each one failing to reach the observed value before the one that does.

Markup: the table frame (border 1px `--line`, radius 8px, background `--page`), three columns (step, value, source), the value column right aligned with tabular numerals, the total row in weight 600. The plain sentence follows the table as normal prose.

## On the page

Width fitted to the content (`max-width` around 760px) so values stay near their labels. Never folded: the figures are the argument.
