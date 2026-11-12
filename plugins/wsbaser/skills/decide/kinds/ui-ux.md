---
when: the issue changes what a user sees or does on a screen
---

# UI and UX

## Signals

The answer changes a screen: how a value is formatted, a label, where a control sits, what a list shows, an empty, loading, error or no-permission state, how many steps a task takes, or whether it can be done with a keyboard or a screen reader. If the user would not notice the change, it is not this kind.

An evident fix on a screen (a typo, a label that contradicts the code) needs none of the work below: one real option, `buttons` mode, no research.

## Research

- Read the screen's code. Note its real field names, labels, column order, formatting helpers and sample values, and the `file:line` of the part the issue is about. Note the design system in use (a component library, tokens, a project override of the mockup form).
- Research the UX convention for this element on the web: platform and design-system guidelines, accessibility guidance, and how established products in the same domain show it. Two sources for a small question, more when the screen is central to the product. Keep each link; they go in `recommendation.sources`.
- Check locale and units where values are shown: currency, decimal separators, dates.

## Skill to consult

`impeccable`, through the Skill tool. Pass the screen (`file:line`), the user's task on it, the conventions you found with their links, and your candidate options. Ask it to critique the options and say which serves the user best. Let its findings reshape the options, not only confirm your pick.

## Attributes and options

- Two or three real options, in `radio` mode, each a genuine way to show the thing. No strawmen to fill the count.
- Each option's `blocks` holds one `ui-mockup` block of the real screen with real values. Build it as the `ui-mockup` form file says: find it in `<skills>/report-design/forms/`, where `.claude/review/forms/ui-mockup.md` in the project replaces it. Every option's mockup shows the same part of the screen at the same scale and with the same data, and numbered pins mark what differs from today. Set the block's `source` to the `file:line` you read; the explanation shows the current screen from the same place.
- Attributes that usually matter: consistency with the rest of the product, accessibility, user effort (clicks or reading), effort to build.
- The recommendation's reason names the convention it follows, and its `sources` hold the links you researched.
