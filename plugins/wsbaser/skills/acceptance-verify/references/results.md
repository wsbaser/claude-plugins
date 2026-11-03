# Results format

`finish.py` merges these files into the run data as a `results` object. The acceptance-run template renders that object, and `build.py` validates it.

## results/run.json

```json
{
  "id": "r-2026-11-01T1500",
  "by": "Claude Opus 5.5 (acceptance-verify)",
  "started": "2026-11-01T15:00:04Z",
  "finished": "2026-11-01T15:31:40Z",
  "env": {
    "app": "https://dev.my7c.is", "tenant": "martin",
    "user": "configured test account",
    "browser": "Chrome headless 1440×900",
    "builds": [ { "label": "FE", "value": "main @ 749706c (31 Oct)", "how": "footer version" },
                { "label": "BE", "value": "unknown", "how": "no version endpoint" } ]
  },
  "notes": "Anything the reader should know about the run as a whole (HTML).",
  "partial": false
}
```

- `user` describes the account, e.g. "configured test account" or a role. It is never a password, and it is not an email address either unless the config says that's fine.
- `partial: true` re-runs only some steps. Earlier results of the other steps are kept, together with their published evidence.
- `finish.py` adds `previous` (a short history of earlier runs) by itself.

## results/steps/&lt;id&gt;.json

```json
{
  "id": "3.7",
  "status": "fail",
  "method": "asserted",
  "cause": "product",
  "started": "2026-11-01T15:21:03Z", "ms": 5200,
  "summary": "Refusal shows the raw code instead of a sentence.",
  "checks": [ { "what": "Banner text", "expected": "Stock has already been taken …", "actual": "ERR_STOCK_ENTRY_CONSUMED", "ok": false, "how": "DOM text of the toast" } ],
  "failure": { "expected": "…", "actual": "…", "diagnosis": "Backend renamed the code in PR 4237; the frontend maps only the old one.", "where": "ValidationMessageService.cs:186" },
  "shots": [ { "src": "evidence/r-…/3.7-1.webp", "cap": "Toast with the raw code", "kind": "failure", "at": "2026-11-01T15:21:06Z", "url": "/martin/inventory/inventory-posting?selectedJournal=52" } ],
  "video": { "src": "evidence/r-…/3.7.mp4", "dur": 6.2 },
  "actions": [ { "t": 1.4, "do": "click", "target": "button \"Reverse journal\"" } ],
  "http": [ { "method": "POST", "url": "/api/inventory/journals/52/reverse", "status": 409, "ok": true, "ms": 95, "key": true, "req": "{}", "res": "{ \"code\": \"ERR_STOCK_ENTRY_CONSUMED\" }", "full": "evidence/r-…/3.7-http-1.json" } ],
  "console": [ { "level": "error", "text": "…" } ],
  "tables": [ { "title": "Stock entries after reversal", "cols": ["Layer", "Qty", "Cost"], "rows": [["L1", "0", "120"]], "source": "GET /api/inventory/items/AT-REV1/layers" } ],
  "records": [ { "label": "Journal {J4}", "route": "inventory/inventory-posting?selectedJournal=[J4]", "kind": "created" } ],
  "values": { "ERRTXT": "ERR_STOCK_ENTRY_CONSUMED" },
  "notes": "Free text for anything unusual (HTML).",
  "retry": false
}
```

| Field | Rule |
|---|---|
| `status` | `pass`, `fail`, `blocked` (its starting state cannot exist because step `needs` failed; requires `needs`), `skip` (optional step left out on purpose), `manual` (only for a step the page marks `human`). `blocked` and `manual` stay "to do" for the reader. |
| `method` | `asserted` (checks compare values read from the page or API), `observed` (judged from a screenshot you looked at), `manual`. `asserted` requires checks. |
| `cause` | Required on `fail`: `product`, `known`, `run`, `env`. Optional on `blocked`. |
| `needs` | Required on `blocked`: the id of the earlier step whose failure makes this one impossible. |
| `summary` | One sentence of what was seen, plain language; required on fail, blocked and manual. |
| `checks` | `actual` is exactly what the app showed. A `pass` cannot contain a check with `ok: false`. A check whose expectation was corrected during the run carries `pageSaid` (the page's original text) and `why` (the evidence for the correction); `expected` is then the corrected value. |
| `failure` | Expected/actual for the headline (left out on screen when a failing check already shows the same pair), `diagnosis`, `where` (`file:line`). On blocked/manual it says why / what to check. |
| `shots` | First entry is the proof and is shown large. `kind`: `proof`, `context`, `detail`, `before`, `after`, `failure`. |
| `video` | The step's own recording: `src` and `dur` in seconds (end clock − start clock). Leave it out when the step has no UI to record. |
| `http` | `ok` overrides the colour for an expected error status. `key: true` shows the call outside the folded trail. |
| `console` | `[]` means captured and clean; leave the field out when not captured. |
| `tables` | Data reads: `title`, `cols`, `rows`, `source` (`"GET /api/…"` or `"SQL: SELECT …"`). `key: true` shows the table with the proof on the step instead of in the folded trail; use it for the read that proves the Expect. |
| `records` | `route` is an app path; `[KEY]` resolves from field values. `label` may use `{KEY}` tokens. |
| `values` | Field keys from `data.groups`. They prefill Test data, so later routes and steps resolve. |
| `acs` | One verdict per AC (`{"AC1": "pass", "AC2": "fail"}`) for a step that covers several ACs. `step.py` derives it from checks that carry `ac`. The AC roll-up uses it instead of the step's overall status. |
| `issue` | Short title shared by every step that fails for the same reason; the Results tab groups them into one item. |
| `workarounds` | Names of the environment patches that changed this step's requests. |

`run.json` may also carry `"inProgress": true` (a progress publish after a phase: the verdict reads "Run in progress", and steps without a result are not flagged) and `"workarounds": [{ "name": "journal-date", "what": "fills the journal date the deployed frontend leaves out" }]`.

## What step.py reads

- `results/raw/<id>.json`: `window.__av.end()` as saved by `evaluate_script` (`id`, `started`, `ended`, `ms`, `checks`, `calls`).
- `results/drafts/<id>.json`: any field of the table above that a script can't know, plus `captions`, `kinds` and `shotMeta` (`[{ "at", "url" }]`) for the shots in order. Draft fields win over derived ones.

All paths are relative to the work folder, and the page is published from there, so the same paths work in the artifact.
