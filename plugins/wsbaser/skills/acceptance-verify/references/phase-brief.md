# Phase brief (for a subagent running one phase)

The orchestrator fills in the angle brackets. Send one phase at a time and wait for it to finish; phases depend on each other.

> You are running phase `<n> · <phase title>` of the acceptance run for `<ticket>` against `<app URL>/<tenant>`. Use **only** the `<browser MCP instance>` tools (load their schemas with ToolSearch first), page id `<page id>`.
>
> The browser is normally logged in already. If you meet the login screen, log in with the test account from `<CLAUDE.local.md path>` "App Credentials", pick company `<company>`, and say so in your report. Never record or screenshot the login.
>
> Read first:
> - `<workdir>/run-data.json`: the steps of phase `<n>` (`steps[].ph == <n>`), with their `d`, `e`, `check`, `fields`, `head` and `k`, the `key` rows they reference, and `meta.knownIssues`.
> - `<skill-dir>/references/evidence.md`: how to capture and verify each step, record its clip and drive grid editors.
> - `<skill-dir>/references/results.md`: the exact format of the step files you write.
>
> Values known so far: `<KEY=value, …>`. Run id: `<run id>`. Evidence folder: `<workdir>/evidence/<run id>/`.
> Environment workarounds in force: `<none | exact description, e.g. the in-page patch and how to re-apply it after a page load>`.
>
> Throwaway names carry the run suffix `<suffix>` (e.g. `AT-REV1-<suffix>`); use the values above, not the page's defaults.
>
> For each step of the phase, in order:
> 1. Make sure `window.__av` exists. If not, load `<workdir>/capture.js` with `evaluate_script`'s `sourcePath`, then `<workdir>/patches/*.js`. For a full page load use `navigate_page` with `initScript` = `(<capture.js text>)()` plus the patches.
> 2. `screencast_start` to `evidence/<run id>/<id>.mp4`, then `__av.begin("<id>")`.
> 3. Do the step. One `__av.check(...)` per Expect clause; for answer-sheet items pass `ac` from `key.colAc`. Proof screenshot to `evidence/<run id>/<id>-1.webp` with the element outlined. Console errors into the draft.
> 4. `__av.end()` with `filePath` = `<workdir>/results/raw/<id>.json`, then `screencast_stop`. Never open another tab while recording.
> 5. Write `results/drafts/<id>.json` with only what a script can't know (summary, cause, failure, issue, captions, actions, records, values, console), then run `python <skill-dir>/scripts/step.py <workdir> <run id> <id> --key N`. Fix what it prints under `needs:`.
>
> Steps failing for one shared reason get the same `issue` title. A failure on something listed in the step's `assume` is cause `run` unless the code shows the app is wrong; a failure the step's `known` predicts is cause `known`.
>
> On a step that does not hold:
> - look once more;
> - if it still fails, record the failure with its cause (`product`, `known`, `run` or `env`);
> - mark the later steps that cannot run `blocked`, with the reason, and keep going with the ones that can.
>
> Rules:
> - Change only the data this run creates, i.e. the `AT …` records, plus what a step explicitly names.
> - Never write credentials or tokens into any file.
> - Don't edit run-data.json, don't build or publish, and don't file tickets.
>
> Return at most 10 lines:
> - the values found;
> - one line per step that didn't pass, with its status, cause and a short reason;
> - anything the next phase must know, e.g. a record that wasn't created or a workaround you had to add.
