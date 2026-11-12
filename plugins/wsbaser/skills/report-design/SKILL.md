---
name: wsbaser:report-design
description: House style for every report page a skill publishes — palette, type, components, when content may be folded, and the fixed script and anatomy for decision pages. Load before writing any report, explainer, review or test-result page so all of them look and behave alike. Not a template: pages are still written freehand.
---

# Report design

The house style shared by every page a skill publishes: explainers, reviews, test results, any report. It gives you the tokens, the component rules, how content is shown and when it may be folded, and, for pages where the owner decides things, a fixed behaviour script. It is guidance, not a template: you still write each page's markup and content by hand, fitted to what the page has to say.

## What to load

Always, for any page:

- `assets/tokens.css`: colours (light and dark), fonts and type sizes. Paste it unchanged as the page's first `<style>`.
- `references/components.md`: how the page shell, reading column, sticky bar, cards, chips, evidence blocks, folds, option radios, buttons and note fields look, and what is banned.

For a decision page (the owner confirms, changes or disputes items and copies the result back):

- `references/decision-page.md`: the issue anatomy, the DOM contract, `#review-data`, counting and dependency rules.
- `assets/review-page.js`: paste it unchanged at the end of `<body>`.

The worked example of all of it is `assets/example-review-page.html`. Open it when a rule is unclear; copy its patterns, not its content.

The Artifact tool's own `artifact-design` skill is still loaded as that tool requires. This skill adds the house style on top of it; where they differ on looks, this skill wins.

## How content is shown: forms

A form is one way of showing something. Forms live in a slot folder, one file per form, and each file opens with a `when:` line saying when it fits. Plain prose is the default when nothing else fits.

To pick forms for a subject:

1. List `forms/` in this skill, and `.claude/review/forms/` in the project being worked on if it exists.
2. Read only the frontmatter `when:` line of each file.
3. Load the files whose `when:` matches the subject. Load nothing else.
4. A project file with the same name as a plugin file replaces the plugin's file.

Each form file says when it fits and when it does not, what data its block holds, how to build it with the tokens, and how it sits on the page. The form name (the file name without `.md`) is the `form` value of a block in the review record.

To add a form, add a file to either folder. No index and no edit to this file.

## The disclosure rule

- Short content is always inline. Never make the reader click to read a few sentences or a few lines.
- A fold is allowed only for long extra depth, such as multi-paragraph background or rejected options argued at length. Its content is 600 characters or more and the reader can decide without opening it.
- A fold's label says how much is behind it, in a unit the reader feels: "Background, 3 paragraphs", "Full listing, 48 lines".
- Show the gist inline above any fold. Keep folds to a few per item, never nested.
- Nothing the decision depends on is folded, and items the agent decided are never shown smaller, dimmer or more collapsed than items that need the owner.

## Writing the page

- One reading column, every item fully visible, top to bottom. No panes, steppers or split summary tables.
- Each item's body has the blocks it needs and no others. Two items rarely have the same shape.
- Lead with the answer; show today before what changes; give `file:line` with every claim about code.
- Inline CSS and JS only, fonts from `fonts.googleapis.com`, icons as inline SVG.
- Publish with the Artifact tool.

## Before publishing

- Light and dark both read well (switch the colour scheme and look).
- The body never scrolls sideways, at laptop width and at phone width; wide content scrolls inside its own frame.
- Every fold is labelled with its size and holds 600 characters or more; nothing short is folded.
- Tokens are pasted unchanged and no colour is hard-coded.
- On a decision page: the script is pasted unchanged, the Recommended tags sit on the right options, and Copy decisions fills the preview.
