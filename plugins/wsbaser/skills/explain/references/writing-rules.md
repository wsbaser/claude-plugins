# Writing rules

These rules apply in every mode: a terminal answer, a published explainer page, and the explanation blocks of a review issue. Each rule has one short example. The examples are illustrations; your subject decides what the explanation looks like.

## Lead with the answer

The first sentence says what is true or what to do, in the reader's terms. When the honest answer rejects the premise of the question, say that first, because nothing else lands until it does.

> Question: "Is the product card cost computed in the frontend or the backend?"
> First sentence: "Neither: the shared pricing library computes it, and both the card and the API call the same `CostCalculator.Total`."

Not: three paragraphs on the architecture before the answer appears.

## Size to the subject

One sentence when one sentence is enough. Ground-up when the reader lacks the background to judge. The length follows what the reader needs, never a target, and never the length of the item next to it.

> A one-line issue: "The log line says `Retrying` but the code gives up after the third attempt (`RetryPolicy.cs:31`); the text should say `Giving up after 3 attempts`."
>
> A race on an estimate total needs more: what the two requests do, a picture of both orderings including the one that loses an update, and what the fix changes in that ordering.

The words the reader chose tell you what they already hold. "It's a black box to me" asks for the pieces and where each lives. A precise symptom from someone who already names the right files asks only for the missing piece.

## Today before the change

Show how it works now before what would change. The reader cannot judge a change to behaviour they have not seen.

> A decision about what a user without permission sees on a page: first "Today the route guard returns `null` (`AppRoutes.tsx:88`), so the user gets an empty page with no message." Then the options: redirect to the start page, or show a "You do not have access" page.

## Define terms before using them

A term the reader may not know is defined where it first appears. For one or two terms, define them inline in a few words. For three or more, give a small grid (term, meaning, where it lives in the code) before the explanation that uses them.

> Inline: "The first consumer (the first service that reads the message off the queue) acknowledges it before saving, so a crash loses the message."
>
> Grid, for a costing explanation that uses three terms:
>
> | Term | Meaning | In the code |
> |---|---|---|
> | Unit cost | supplier price per piece | `Product.UnitCost` |
> | Landed cost | unit cost plus freight and duty share | `CostCalculator.cs:40` |
> | Card cost | landed cost times quantity, as the card shows it | `CostCalculator.cs:57` |

## Show the code, with `file:line` before it

A claim about code comes with the code. The sentence before the excerpt gives `file:line`, so the excerpt is already introduced, and the lines the prose names are highlighted. Copy the lines from the file you read; never retype or tidy them.

> "The card shows 171,600 while the invoice shows 171,600.48 because `CostCalculator.cs:57` rounds each line before summing, so twelve lines of 14,300.04 lose 0.04 each:" followed by the excerpt starting at line 54, with line 57 highlighted, and then the worked figures (12 × 14,300.04 = 171,600.48; 12 × 14,300 = 171,600).

## Split someone else's claim and judge each part

When the subject is a claim someone else made (a reviewer's comment, a bug report, a colleague's theory), quote it, split it into its separate assertions, and give a verdict on each with its evidence. A claim is often partly right; one overall verdict hides which part.

> Comment: "This lookup can return null and there is no test for it."
>
> - "Can return null": valid. `UserStore.Find` returns `null` when the id is unknown (`UserStore.cs:41`).
> - "No test for it": not valid. `UserStoreTests.cs:88` covers the unknown id and asserts the `null`.
>
> So the guard is worth adding; the test already exists.

## State unknowns where the claim is made

What you did not verify is said in the sentence that makes the claim, not in a footnote or a closing "limitations" section, where the reader has already believed the claim.

> "The retry runs at most three times (`RetryPolicy.cs:22`); checked by reading the code, not by running it."

## Put sources inline

Each figure and each claim carries its source where it appears: `file:line`, a link, a ticket, a report. No reference list at the bottom that the reader must match back.

> "About 41 clients run an older version (12% of 340 on-prem installs, from the October licence report)."

## No fixed section template

Do not give every explanation the same headings (Context, Problem, Solution, Risks) or the same set of parts. Each explanation has the parts its subject needs and no others, so two explanations of different weight look different.

> In one review: the one-line issue is a single sentence; the race is a sentence, a picture of both orderings and a short code excerpt; the page decision is a sentence and the current screen, with each option showing its own screen.
