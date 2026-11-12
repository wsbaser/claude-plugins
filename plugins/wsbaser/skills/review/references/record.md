# The issue record

One JSON file per review holds every issue, from intake to the owner's decision. All four skills (`review`, `decide`, `explain`, `report-design`) read and write this shape. Field names here are the contract.

The file is named `review.json` and lives in a folder `review-<review.id>/`. The caller chooses where that folder goes; the default is the session scratchpad.

## Shape

```json
{
  "schema": 1,
  "review": { "id": "pr-2317-log-levels", "title": "PR #2317 \"Normalize log levels\"", "round": 2 },
  "issues": [
    {
      "id": "1",
      "title": "One transport failure is logged as Error in two layers",
      "round": 1,
      "kind": "code design",
      "needsOwner": true,
      "needsOwnerReason": "no clear winner",
      "origin": { "quote": "...", "author": "reviewer", "where": "SyncSession.cs:142", "verdict": "valid", "verdictReason": "..." },
      "attributes": [ { "label": "Confidence", "value": "Medium" } ],
      "explanation": [ { "form": "prose", "text": "..." } ],
      "mode": "radio",
      "options": [ { "id": "A", "label": "...", "attributes": [], "blocks": [] } ],
      "recommendation": { "option": "A", "reason": "...", "confidence": "medium", "sources": [], "unverified": [] },
      "dependsOn": null,
      "decision": { "by": null, "choice": null, "note": "", "status": "undecided" }
    }
  ]
}
```

## Review fields

| Field | Meaning |
|---|---|
| `schema` | Always `1`. |
| `review.id` | Stable id of the review, matching `^[a-z0-9-]+$`. Names the folder `review-<id>/`. |
| `review.title` | Human title of the review. Non-empty. |
| `review.round` | Current round, `>= 1`. Grows when the review is run again on the same subject. |
| `review.artifactUrl` | Optional string. Written by the `review` skill when the page is published; absent before that. |

## Issue fields

| Field | Meaning |
|---|---|
| `id` | Stable id, unique in the record, matching `^[A-Za-z0-9-]+$`. |
| `title` | Non-empty, one line. |
| `round` | The round the issue was added in or last reworked in (a re-think after a dispute, or a dependent whose map or recommendation was redone); `1 <= round <= review.round`. Raising it makes the review page drop the owner's saved state for that issue. |
| `kind` | Free text chosen by the agent (for example "code fix", "PR comment", "product question", "UI/UX"). Routes research and skill choice. Not a closed list. |
| `origin` | `null` when the skill found the issue itself. Otherwise the claim someone else made: `quote`, `author`, `where` (what it points at), `verdict` (`valid`, `not-valid` or `partly`: the agent's judgement of the claim) and `verdictReason`. Validity exists only for issues that came from someone else's claim. |
| `attributes` | Free list of `{ "label", "value" }` pairs picked for this issue: confidence, severity, complexity, risk, reversibility, effort, blast radius, or others. No fixed set. |
| `explanation` | Ordered content blocks (see Blocks). |
| `mode` | `radio` (two or more real options) or `buttons` (exactly one real option plus dispute options). |
| `options` | One or more options (see Options). |
| `recommendation` | The chosen option with the reason. `null` only for a pure preference question; then `needsOwner` must be `true`. |
| `needsOwner` | `true` when the owner must decide. Then `needsOwnerReason` is non-empty (no clear winner, costly to reverse, a product decision only the owner can make). |
| `needsOwnerReason` | Why the owner is needed; empty string when `needsOwner` is `false`. |
| `dependsOn` | `null`, or `{ "issue": "<parent id>", "map": { "<parent option id>": "<own option id>" }, "note": "<what changes>" }`. For each answer to the parent issue, `map` says what the recommendation here becomes. The parent must exist, must not be the issue itself, and the chain must not loop. |
| `decision` | `by` (`agent`, `owner` or `null`), `choice` (an option id or `null`), `note` (the owner's note), `status` (`decided`, `undecided` or `disputed`). When `by` is `agent`, `choice` must be an existing option id. |

### Options

Each option has `id` (unique within the issue), `label` (what it does), `attributes` (what is needed to choose it) and `blocks` (content blocks that show it). An option with `"dispute": true` is a dispute option (for example `reject`, `discuss`); it can never be recommended and does not count as a real option. An option may carry `outcome`: short text of what choosing it does, used in the copied text.

### Recommendation

`option` names an existing non-dispute option, `reason` is non-empty, `confidence` is a short word, `sources` lists links and `file:line` references, `unverified` lists claims the agent could not verify.

### Blocks

A block is `{ "form": "<form file name without .md>", ... }`. The remaining keys belong to the form. A fold is `{ "form": "fold", "label": "...", "size": "48 lines", "blocks": [ ... ] }`: a collapsed group whose `label` and `size` are shown closed. The text and code inside a fold total at least 600 characters; short content is never folded.

## Stages

The record is validated at the stage the pipeline has reached. Each stage includes the earlier ones.

| Stage | Who fills it | Rules |
|---|---|---|
| `intake` | `review` | `schema == 1`; `review.id`, `review.title`, `review.round` valid; issue ids unique; titles non-empty and single-line; `1 <= issue.round <= review.round`. Fields: id, title, round, origin quote, author and where. |
| `decided` | `decide` | Adds `kind`, `attributes`, `options`, `mode`, `recommendation`, `needsOwner`, `dependsOn`, the origin `verdict` and `verdictReason`, and an agent `decision` where the agent can decide. May also add option `blocks` when the kind needs the owner to see the option itself, such as a mockup. Rules: options non-empty with unique ids; `mode` matches the real option count; the recommendation names a non-dispute option and has a reason; `needsOwner` true needs a reason; a null recommendation needs `needsOwner`; `origin` has `quote`, a legal `verdict` and `verdictReason`; `dependsOn` points at an existing other issue, with no cycle, and its map uses real option ids on both sides; an agent decision names an existing option. |
| `ready` | `explain` | Adds `explanation` and option `blocks`. Rules: `explanation` non-empty; every block has `form`; every fold has `label` and `size` and holds at least 600 characters. |

## Commands

```bash
python scripts/check_record.py <review.json> --stage ready
python scripts/check_slots.py <folder> [<folder>...]
```

`check_record.py` prints one error per line and exits 1 when there are errors. Errors about an issue start with `issue <id>: `. `check_slots.py` checks that every file in a slot folder is kebab-case Markdown whose frontmatter has a non-empty one-line `when:` key.
