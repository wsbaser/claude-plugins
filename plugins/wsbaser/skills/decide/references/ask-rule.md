# The ask rule

This file alone decides when an issue goes to the owner. It is the tuning point for autonomy: when too many questions reach the owner, or too few, edit this file and nothing else.

## Ask when any of these holds

Set `needsOwner: true` when at least one trigger holds:

1. **No clear winner.** No option is clearly better on the evidence. Two options trade different goods (speed against clarity, consistency against correctness) and nothing you found settles which matters more here.
2. **Costly to reverse.** The choice changes a data shape (a stored format, a schema, a migration), a public contract (an API, an event, a file format, a setting other people configure), anything users or other teams will build on, or anything shipped to customers. Undoing it later means a migration, a breaking change or a message to the people who depend on it.
3. **Only the owner can make it.** It is a product or priority decision: what the product should do, for whom, in what order, what is in scope, or how to trade time against features.
4. **Low confidence.** The facts your pick rests on could not be verified, or the confidence you would write on the recommendation is low.

Otherwise decide: set `needsOwner: false`, `needsOwnerReason: ""`, and record the agent decision.

## Always recommend

Give a recommendation whenever one is defensible, also when you ask. The owner decides fastest when the best guess is already selected and its reason is next to it. Leave `recommendation` as `null` only for a pure preference question where the evidence favours no option; then `needsOwner` is `true`.

## Not reasons to ask

- The issue feels important, but one option is clearly best and cheap to undo.
- The change is large. Effort is not the cost of reversal: a big local change that can be reverted is decided like a small one.
- Someone else raised it. A claim is judged on its evidence like any other issue.
- The answer follows fully from another issue's answer through `dependsOn`. Ask about that parent issue instead.
- The owner might have an opinion. Ask only when a trigger above holds.

## Writing the reason

`needsOwnerReason` names the trigger and the fact that makes it hold, in one line: "costly to reverse: renames a public endpoint that customer integrations call", "no clear winner: both formats are common in this domain and the product has no precedent". Never "important" or "needs review".
