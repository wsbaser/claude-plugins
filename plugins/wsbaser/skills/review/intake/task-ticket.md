---
when: the topic is a ticket, story or task to analyse before implementing
---

# Ticket to analyse before implementing

Turns a ticket into the open questions and risky assumptions that must be settled before anyone writes code. The issues are found by you; nobody made a claim, so every `origin` is `null`.

## Read everything first

1. The ticket itself: summary, description, acceptance criteria, comments. Use the tracker's tool the session has (an MCP server, `az boards work-item show --id <id>`, or the file the caller gave).
2. Every linked source, in full: parent and linked tickets, attached documents and designs, linked wiki or Confluence pages, mockups. A link you cannot open is a fact worth an issue only when the ticket depends on it; otherwise note it as unread and say so to the owner.
3. The code the ticket touches: find the entry points, follow the flow the change will alter, and keep the `file:line` of what you read. Read across repositories when the flow goes there.

Do not start listing issues before the reading is done: half the questions disappear once the code is read, and the real ones only show up there.

## What becomes an issue

An issue is something where a wrong guess costs rework, a wrong product behaviour, or a hard-to-reverse change:

- **Product**: behaviour the ticket leaves open or contradicts (who sees what, what happens in the edge case, what the numbers should be).
- **Technical**: where the change belongs, what it breaks, data shape and migration, contracts other code relies on.
- **UI/UX**: how a screen or control should look or behave where the ticket or design does not say.
- **Risky assumptions**: something the ticket takes for granted that the code or data says otherwise about.

Not an issue: what the ticket already answers, and small choices an implementer settles in passing without anyone noticing. A question with an evident answer may still be an issue when getting it wrong would be costly; the decision step will settle it quickly.

## Each issue

| Field | Value |
|---|---|
| `id` | `1`, `2`, ... in the order found. |
| `title` | The question or assumption, in one line. |
| `round` | The current `review.round`. |
| `origin` | `null`. |

## The review

- `review.id`: the ticket key in lower case plus two or three words from its summary, kebab-case.
- `review.title`: `<ticket key> "<ticket summary>"`.
- Pass to the decision step, as pointers: the ticket and the sources you read, and per issue the `file:line` and links that raised it.
