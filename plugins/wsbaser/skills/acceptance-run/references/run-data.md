# Run data format

`scripts/build.py` turns one JSON file into the page. Everything the tester sees comes from this file; the template holds no ticket-specific text.

## Contents
- Top level
- Tokens and links inside text
- meta
- domain (tab "Why it exists")
- phases and steps (tab "Run")
- data (tab "Test data")
- key (tab "Expected results")
- how (tab "How it works")
- ac (tab "Sign-off")
- Minimal example

## Top level

```json
{ "meta": {}, "domain": {}, "phases": [], "steps": [], "data": {}, "key": {}, "how": {}, "ac": {} }
```

`meta`, `phases` and `steps` are required. A tab whose key is missing is not shown.

## Tokens and links inside text

Text fields are HTML (use `<b>`, `<code>`, `<ul>`; keep markup light). Two placeholders are replaced live:

- `{KEY}` — the current value of test-data field `KEY` (upper case, digits, underscore), shown as a chip. When the field is empty the chip shows the field's `short` label in amber with a `?`, so a missing value is visible wherever it is used.
- `{R:path}` — a link to `<app URL>/<alias>/<path>` that opens in a new tab. Use it for every screen the tester has to open. Write `[KEY]` inside the path for a value found during the run, e.g. `{R:inventory/journals/[JA]}` links to the journal number the tester typed into field `JA`.

Inside `steps[].code[].text` tokens are replaced with raw values (no chips) so the snippet can be pasted as is; `{BASE}` and `{ALIAS}` are available there too.

## meta

| Field | Meaning |
|---|---|
| `ticket` | Ticket key shown in the top bar, e.g. `S7C1-4806` |
| `ticketUrl` | Link to the ticket |
| `title` | Short feature name, shown under the key |
| `sliceLabel` | `FE only`, `BE only` or `FE + BE`, shown after the title |
| `appBase` | App URL from the project config, e.g. `https://dev.my7c.is` (empty for BE-only API runs if there is no UI) |
| `alias` | Tenant / company path segment, if the app has one |
| `storageKey` | Unique per ticket, e.g. `s7c1-4806`; results are stored in the viewer's browser under it |
| `knownIssues` | Optional list of strings appended to the copied summary, e.g. `"S7C1-5073 (duplicate exception via Undo)"` |

## domain

```json
"domain": {
  "figures": [ { "h": "What a reversal does to stock", "html": "<figure class=\"fig\"><div class=\"fig-scroll\"><svg class=\"dg dg-run\" role=\"img\" aria-label=\"…\" viewBox=\"0 0 1040 300\">…</svg></div><figcaption>The takeaway sentence.</figcaption></figure>" } ],
  "main": [ { "h": "The real-life problem", "html": "<p>…</p>" } ],
  "side": [ { "h": "One invoice, booked", "html": "<table class=\"dt ledger\">…</table>" } ]
}
```

`domain` is required, and `figures` must hold at least one inline-SVG picture. Figures render full width above the cards, and their HTML is inserted as is: use `<tspan data-t="KEY">` for live values, never `{KEY}`. Make it with `scripts/storyboard.py` (a Before / Now storyboard); see `domain-picture.md`.

Below the figures come two columns of cards. `main` carries the narrative (problem, how it works in real life, why it is built this way); `side` carries the compact things a reader glances at (worked example, who benefits, glossary, what to keep in mind while testing). Classes the template styles for you: `dl` (spaced list), `gl` on a `<dl>` (glossary), `dt ledger` table with `num` cells and a `tot` row, `matrix-pair` / `mx` (before/after grids with `def`, `exc`, `gap` cells), `src def` / `src exc` (small tags), `cap` (muted caption).

## phases and steps

```json
"phases": [ { "t": "Prepare the test data", "d": "Log in as … Everything named \"AT …\" is throwaway." } ],
"steps": [
  {
    "id": "2.3", "ph": 2, "t": "Override only excl VAT and save",
    "ac": ["AC2"],
    "d": "On the card set <b>Sales excl VAT</b> = {OEXCL}. Save.",
    "e": "Saved. The card reads \"Override for {CPGF}\".",
    "b": "Why this matters to the business user.",
    "k": "What the backend does: endpoint, rule, table, error code.",
    "fields": ["OEXCL"],
    "check": "4.4",
    "head": "Where the build differs from the ticket at this step.",
    "optional": false,
    "code": [ { "label": "HTTP", "lang": "http", "text": "PUT {BASE}/api/sales/postinggroups\n…" } ]
  }
]
```

| Field | Meaning |
|---|---|
| `id` | `phase.step`, unique; also what ACs and the answer sheet refer to |
| `ph` | Index into `phases` |
| `t` | Title, short imperative or noun phrase |
| `d` | Do: the exact action, with menu path, route link and values |
| `e` | Expect: what the tester must see to pass, in the app's own words (labels, messages) |
| `b` | Business meaning, one or two sentences, plain language |
| `k` | Backend: what happens server-side; shown folded, opens by itself when the step fails |
| `fields` | Test-data keys the tester fills while on this step (e.g. an invoice number after posting) |
| `check` | Id of a `key.rows` entry; its expected values render as a table inside Expect |
| `head` | Ticket-vs-build difference relevant to this step only |
| `optional` | Marks the step optional |
| `code` | Snippets with a Copy button: HTTP requests, curl, SQL |

## data

```json
"data": {
  "lead": "optional sentence above the cards",
  "groups": [
    { "title": "Ledger accounts", "note": "step 0.1", "cap": "caption under the card",
      "fields": [ { "k": "DINCL", "label": "Default · sales incl VAT", "short": "default incl acct", "value": "1000", "placeholder": "number" } ],
      "table": { "cols": ["Sales incl VAT", "Sales excl VAT"],
                 "rows": [ { "label": "Group default", "cells": [ { "k": "DINCL" }, { "k": "DEXCL" } ] },
                           { "label": "Temporary", "cells": [ { "k": "TINCL" }, { "text": "not used" } ] } ] } }
  ]
}
```

Every token used anywhere must be a field here. `value` is the prefilled value found in the environment (empty when unknown); `short` is what a missing value reads like inside steps. Give a group a `table` when its fields form a grid; without one the fields render as label/input rows.

## key

The answer sheet: one row per check step, one column per thing being checked.

```json
"key": {
  "tab": "Expected accounts", "title": "Answer sheet", "lead": "…",
  "contextHead": "Invoice", "itemHead": "Item", "valueHead": "Credited to",
  "cols": ["{ITEMV}", "{ITEMZ}"],
  "rows": [
    { "step": "4.4", "context": "{INV2} · {CUSTB}",
      "items": [ { "v": "DINCL", "tag": "def", "why": "default, exception field empty" },
                 { "v": "OEXCL", "tag": "exc", "why": "exception" } ] }
  ],
  "diagramHtml": "<figure class=\"fig\">…timeline svg…</figure>"
}
```

`items[i]` lines up with `cols[i]`. `why` may contain `{TOKEN}`s. `v` is a field key (its live value is shown); use `text` instead for a literal (`"text": "200 OK"`). `tag` is `def` (neutral) or `exc` (highlighted, the thing the feature changes).

## how

```json
"how": {
  "sections": [ { "h": "How posting picks the revenue account", "html": "<figure class=\"fig\">…</figure>" } ],
  "deviations": [ { "title": "Hint format", "html": "The hint reads …" } ]
}
```

Diagrams are inline SVG inside `<figure class="fig"><div class="fig-scroll"><svg class="dg dg-rule" …>`. Use `dg-rule` (900 px) or `dg-run` (1040 px) on the `svg` so it keeps a fixed reading size. Template classes for shapes: `box`, `q` (decision), `acc-box`, `ln`, `dash`, `grid`, `bar-none`, `bar-on`, `guide`, `dotc`, `dot-hollow`; for text: `sm`, `mono`, `acc`, `tick`. A `<tspan data-t="KEY">` inside SVG shows a field's live value.

## ac

```json
"ac": { "AC1": ["A sales posting group applies to all customer posting groups", ["1.2", "4.1", "5.3"]] }
```

Criterion text as in the ticket (shortened if long), and the ids of the steps that prove it.

## Minimal example (BE-only step)

```json
{
  "meta": { "ticket": "S7C1-9999", "ticketUrl": "https://example.atlassian.net/browse/S7C1-9999", "title": "Customer group codes", "sliceLabel": "BE only", "appBase": "https://dev.example.com", "alias": "", "storageKey": "s7c1-9999" },
  "phases": [ { "t": "Create through the API", "d": "Requests run against {BASE} with a bearer token from the browser session." } ],
  "data": { "groups": [ { "title": "Values", "fields": [ { "k": "TOKEN", "label": "Bearer token", "short": "token", "placeholder": "copy from DevTools" }, { "k": "GID", "label": "Created group id", "short": "group id", "placeholder": "after 0.1" } ] } ] },
  "steps": [
    { "id": "0.1", "ph": 0, "t": "Create a group", "ac": ["AC1"],
      "d": "Send the request. Copy the returned <code>id</code> into the field.",
      "code": [ { "label": "HTTP", "text": "POST {BASE}/customers/groups\nAuthorization: Bearer {TOKEN}\nContent-Type: application/json\n\n{ \"code\": \"AT1\", \"name\": \"AT group\" }" } ],
      "fields": ["GID"],
      "e": "<code>201 Created</code>; body has <code>code</code> = <code>AT1</code>.",
      "b": "A group code is what accountants type on reports.",
      "k": "<code>CreateCustomerGroupEndpoint</code> validates the code is unique (<code>ERR_CODE_DUPLICATE</code>)." }
  ],
  "ac": { "AC1": ["Group can be created with a code", ["0.1"]] }
}
```
