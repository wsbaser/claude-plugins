# The decision text

The review page lets its owner decide issues, then copies a plain text of the decisions. The owner pastes it back to the agent. `scripts/parse_decisions.py` reads the text and merges it into the record (`review.json`, see `record.md`). The page script that writes the text (`buildText`) must emit exactly this format.

## Format

```
Decisions for PR #2317 "Normalize log levels", review round 2
Review: pr-2317-log-levels
2 of 4 decided

1. One transport failure is logged as Error in two layers
   Decision: [B] Error once in the transport, SyncSession logs Debug (owner chose)
2. Client older than the gateway: Warning or Information? [new in round 2]
   UNDECIDED. Agent recommends [C] Warning for one release, then Information.
   Depends on: issue 1 = [B] (confirmed)
3. Request logging crashes when the request has no identity
   Decision: [accept] Accept - apply the null guard (agent decided, owner left it)
4. Retry attempts are logged too loud
   DISPUTED: [reject] Reject (owner chose)
   Note: Ops still wants these at Warning during the migration

Undecided: 2. Do not act on these yet.
Disputed: 4. Re-think these using the notes.
```

This text is `tests/fixtures/decisions-round2.txt`, the state of `tests/fixtures/review-round2.json` (decisions cleared except as shown). Both the parser tests and the page script tests read it.

## Rules

- First line: `Decisions for <review title>, review round <N>`. Second line: `Review: <review.id>`. Third line: `<n> of <m> decided`. Then a blank line.
- An issue line is `<id>. <title>`, with ` [new in round N]` after the title when the issue was added in a later round. It starts at column 0.
- The lines under an issue are indented three spaces.
- The option id is always in square brackets.
- A decided issue: `Decision: [<option id>] <label>`, plus ` - <outcome>` when the option has an `outcome`, then the who-part in parentheses.
- A disputed issue: `DISPUTED: [<option id>] <label>` and the who-part.
- The who-part is one of `agent decided, owner left it`, `owner confirmed`, `owner chose`. The parser reads `agent decided, owner left it` as `by: agent`, and `owner confirmed` and `owner chose` as `by: owner`.
- An undecided issue: `UNDECIDED. Agent recommends [<option id>] <label>.` or, with no recommendation, `UNDECIDED. No recommendation.`
- `Depends on: ...` appears under an issue that depends on another one. It is informational.
- `Note: <text>` carries the owner's note. Line breaks inside a note are replaced by ` / `. The parser keeps the note as written.
- The footer lines `Undecided: <ids>. Do not act on these yet.` and `Disputed: <ids>. Re-think these using the notes.` appear only when their list is non-empty.

## How it is read

- Issues are matched by id only, never by title. Titles and notes may hold `"`, `<`, ` - ` and `[A]`.
- Lines are cut at line ends of any kind and trailing spaces are dropped. A line that starts neither an issue nor a known keyword (`Decision:`, `DISPUTED:`, `UNDECIDED.`, `Note:`, `Depends on:`) continues the line before it, so soft-wrapped text still reads.
- The header count line, the `Depends on:` line and the footer lines are known lines. They are never checked against the issue blocks.
- Nothing is guessed. An issue block that cannot be read (no decision line, a cut-off decision line without its who-part, an unreadable option, a repeated issue id) is reported in `problems` and the issue ends up undecided. The same holds for an issue missing from the paste, an option id the issue does not have, and an issue id the review does not have.
- A paste with a different `Review:` id, or none, is refused whole: nothing is applied.
- `settled` is true only when no issue is undecided or disputed and there are no problems.

## Command

```bash
python scripts/parse_decisions.py <review.json> < pasted.txt
```

Writes the merged record back to `review.json` and prints `{ "settled", "undecided", "disputed", "problems" }` as JSON.
