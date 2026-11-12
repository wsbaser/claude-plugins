---
when: plain explanation in sentences; the default when nothing else fits
---

# Prose

## When it fits

Use prose for anything a reader understands from a few sentences: what goes wrong, why, what the fix does. It is the default; pick another form only when its `when:` line matches the subject better. Do not use prose to describe what a picture, a table or the code itself would show faster: three values compared across four options is a table, not a paragraph.

## How to build it

Block: `{ "form": "prose", "text": "..." }`. `text` holds one or more paragraphs separated by a blank line.

- Lead with the answer. The first sentence says what is true or what to do.
- Name the code you talk about with `file:line` in the sentence, so a code block that follows is already introduced.
- Define a term the first time you use it, inline, in a few words.
- Say what was not checked in the sentence that makes the claim, not in a footnote.
- Use backticks for identifiers; the page renders them as inline `<code>`.

Markup: each paragraph is a `<p>` in the body font (`--font-body`, `--fs-md`), colour `--fg`, line length capped near 78 characters (`max-width: 78ch`). A side remark goes in a caption paragraph (`--fs-sm`, `--muted`).

## On the page

Full column width up to the line-length cap. Never folded: prose that is long enough to fold is usually several subjects and should be split into blocks, and only extra depth of 600 characters or more may go into a fold.
