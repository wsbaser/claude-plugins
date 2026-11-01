# Capturing evidence

What to collect at each step, how to collect it with the browser tools (Chrome DevTools MCP names shown; other browser tools have equivalents), and how it appears on the page.

## Contents
- The kinds of evidence and what each proves
- One step, start to finish (UI)
- API steps (BE-only)
- Mixed steps (UI action, server-side effect)
- Screenshots: which, how many, how
- Recording and timestamps
- Network capture and redaction
- Files and names

## The kinds of evidence and what each proves

| Evidence | Proves | Captured | Shown |
|---|---|---|---|
| Checks (expected / actual) | The Expect holds, compared programmatically | Every step with a verifiable Expect | Top of the step, as a table |
| Proof screenshot | What the reader would have seen at the Expect moment | Every UI step | Large thumbnail under the checks; viewer with zoom |
| Context, before and failure screenshots | Where it happened; the state before a change; the page at failure | When they add information (see below) | Small thumbnails next to the proof |
| Step recording | The step was really done, start to finish | One clip per UI step, in real time | Next to the proof screenshot and "Watch this step" on the step; Evidence tab |
| Action trail | Exactly what was clicked, typed and opened | Every step | Folded "Full trail"; timestamps jump into the step's recording |
| API exchange | What the server was asked and answered | API steps; the call behind a UI action | Key call under the screenshots; all calls in the trail and the Evidence tab |
| Data reads (tables) | A server-side effect the screen doesn't show (ledger rows, stock entries) | When an Expect is about stored data | Small table in the trail |
| Console | No hidden client errors | Errors and warnings per step | Trail; totals on Results |
| Records | The reader can open what the run made | Every created or changed record | Trail; "Data the run created" on Results |
| Values | Ids and numbers found during the run, e.g. a journal number | Steps that have `fields` | Prefilled into Test data, so routes and later steps resolve |

## One step, start to finish (UI)

1. **Start recording:** `screencast_start` to `evidence/<run-id>/<step>.mp4`, then `evaluate_script` → `() => window.__av.tickStart("Step <id>")`. It returns the start clock. Keep it as `started`, in ISO with `Z`. Call `__av.take()` once to drop calls from before the step.
2. **Before shot,** only when the Expect is a change ("goes from 10 to 0", "the hint disappears"). Take it now.
3. **Act.** `take_snapshot` for uids, then `click`, `fill`, `press_key`, `navigate_page`. Log each as an action: `{ "t": seconds since the start clock, "do": "click", "target": "button \"Reverse\"", "value": "" }`. Name targets by role and visible label, the way the reader sees them, not by uid.
4. **Wait** for the result: `wait_for` on the expected text, or for the network to go quiet.
5. **Verify.** Read each Expect clause with `evaluate_script`, e.g. `el.innerText` of the banner, the cell or the status pill. Compare it with the Expect string, normalising only whitespace. Write one check per clause:
   `{ "what": "Banner text", "expected": "…", "actual": "…", "ok": true, "how": "DOM text of the toast" }`.
   For a `check` step, add one check per answer-sheet item, using its `v` field's value.
6. **Proof shot.** Outline the element that proves the step: `__av.outline(selector)`, or `__av.outline(null, "visible text")`. That also scrolls it into view. Take a viewport screenshot, then `__av.clear()`. If the proof is small text in a big screen, also take an element screenshot (`uid`, kind `detail`).
7. **Network and console:**
   - Save `() => window.__av.take()` to a file with `evaluate_script`'s `filePath`. Then run `python <skill-dir>/scripts/http_evidence.py <file> <workdir> <run-id> <step> --key N` to get the step's `http` list, with full bodies written to `evidence/`. `list_network_requests` mixes in hundreds of static files, so use it only if the helper is missing.
   - `list_console_messages` for `error` and `warn`.
8. **Values and records.** Anything the step's `fields` ask for goes into `values`. Anything created or changed goes into `records` with an app route, e.g. `inventory/journals/[J1]`.
9. **Stop recording:** `__av.tickStop()` returns the end clock. Then call `screencast_stop`. Set `video` to `{ "src": "evidence/<run-id>/<step>.mp4", "dur": (end − start) / 1000 }` and `ms` to end − start.
10. **Write** `results/steps/<id>.json`.

## API steps (BE-only)

- **Send the request.** Use the step's `code` snippet with the values filled in. Send it either through the logged-in page (`evaluate_script` with `fetch`, so the browser session authenticates it) or with `curl` and a token you hold only in a shell variable. The token never goes into a file.
- **Record the exchange** in `http`:
  - method, path, status, `ms`;
  - the request body, and the response body (excerpt up to about 3 KB).
  - The full response goes in a file under `evidence/`, referenced by `full`.
  - Set `key: true` on the call that proves the step.
  - When an error status is the expected outcome (a 409 for a refused action), set `"ok": true`. The status then shows green.
- **Write checks on the response:** `{ "what": "status", "expected": "409", "actual": "409", "ok": true, "how": "HTTP status" }` and one per JSON field the Expect names (`how: "$.code"`).
- **Screenshot only if a screen shows the result.** A pure API step can pass without one. The page then leads with the checks and the key call.
- **Effects the response can't show** (rows written elsewhere): read them back through a read endpoint, or SQL if the config gives read-only DB access. Record them as a `tables` entry with its `source`.

## Mixed steps (UI action, server-side effect)

Run the UI flow, then attach the API call the action triggered, marked `key: true`. If the Expect is about stored data that no screen shows, read it back as a `tables` entry. That table, beside the screenshot of the button press, is what convinces a reader that the whole slice works.

## Screenshots: which, how many, how

- Take one **proof** shot per UI step: the moment the Expect is visible, with the element outlined. It is the first entry in `shots`, and the page shows it large. Caption it with what it proves, not what the screen is: "Banner: reversal refused, 2 of 6 already used", not "Journal page".
- Add **context** or **detail** only when the proof shot leaves a question. Add **before** for changes. Add **failure** (full page, `fullPage: true`) on every failed step.
- Use the WebP format at quality 80 and a 1440×900 viewport. Wait until spinners and toasts have settled. A half-loaded page is not evidence.
- Fill `at` (ISO time with `Z`) and `url` (the app path without the host) on each shot. The viewer shows both, in the reader's local time.

## Driving grid editors

Spreadsheet-style grids (DevExpress and similar) don't put their cells in the accessibility tree.
- To edit, double-click the cell, wait for the editor, type with `type_text`, and press `Tab` or `Enter` to commit.
- To read, query the grid's rows with `__av.text("<row selector>")`, rather than the snapshot.

## Recording

Record one clip per UI step, never one per phase.

The screencast stores a frame only when the screen changes and plays the frames back at a fixed rate. A recording of a mostly still page therefore plays as a time-lapse: a 7-minute phase played in 8 seconds. The ticker from `__av.tickStart` changes a corner of the screen ten times a second, so the clip plays in real time. Its label also stamps the step id into every frame.

- Start the recording after login, so it never contains a password.
- A full page load removes the ticker and the helper. Install the helper again and call `tickStart` again.
- A step done in a second tab, such as a stale-screen test, needs its own `screencast_start` on that page. Otherwise it has no clip, which is acceptable; say so in the step's notes.
- Keep each clip under 15 MB. A normal step is well under 1 MB.

## Network capture and redaction

Keep request and response bodies, but before writing them:
- drop the `Authorization`, `Cookie` and `Set-Cookie` headers entirely (headers aren't stored anyway);
- replace values of `password`, `token`, `access_token`, `refresh_token`, `secret` and `apiKey` with `"[redacted]"`;
- keep personal data out. Use the run's own `AT …` records; they hold no real customer data.

## Files and names

```
<workdir>/
  run-data.json                 from extract.py
  results/run.json              run-level facts
  results/steps/<id>.json       one per step
  evidence/<run-id>/
    2.3.mp4                     the step's recording
    2.3-1.webp  2.3-2.webp      <step>-<n>
    2.3-http-1.json             full response bodies
```

The run id is unique per run, e.g. `r-2026-11-01T1500`. Evidence lives under it, so a later run never overwrites an earlier run's files.
