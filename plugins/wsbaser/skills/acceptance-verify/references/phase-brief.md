# Phase brief (for a subagent running one phase)

Fill in the angle brackets. Send one phase at a time and wait for it to finish; phases depend on each other.

> You are running phase `<n> · <phase title>` of the acceptance run for `<ticket>` against `<app URL>/<tenant>`. The browser is already logged in: use **only** `<browser MCP instance>` tools, page id `<page id>`, and do not log in, log out or open other tenants.
>
> Read first:
> - `<workdir>/run-data.json`: the steps of phase `<n>` (`steps[].ph == <n>`), their `d`, `e`, `check`, `fields`, `head`, `k`, the `key` rows they reference, and `meta.knownIssues`.
> - `<skill-dir>/references/evidence.md`: how to capture and verify each step.
> - `<skill-dir>/references/results.md`: the exact format of the step files you write.
>
> Values known so far: `<KEY=value, …>`. Run id: `<run id>`. Evidence folder: `<workdir>/evidence/<run id>/`.
>
> Do:
> 1. Start the screen recording to `evidence/<run id>/phase-<n>.mp4` and read `Date.now()` as the phase clock.
> 2. Run each step of the phase in order. Verify against the Expect by reading the page or API (checks with exact `actual`), take the proof screenshot with the element outlined, capture the key API call and the console, and write `results/steps/<id>.json` after every step.
> 3. On a step that does not hold, look once more, then record the failure with its cause (`product`, `known`, `run`, `env`). Mark the later steps that cannot run as `blocked` with the reason, and keep going with the ones that can.
> 4. Stop the recording and return its duration.
>
> Rules:
> - Change only the data this run creates, the `AT …` records, plus what a step explicitly names.
> - Never write credentials or tokens into any file.
> - Don't edit run-data.json, don't build or publish, and don't file tickets.
>
> Return at most 10 lines:
> - the video entry (`id`, `src`, `dur`);
> - the values found;
> - one line per step that didn't pass, with its status, cause and a short reason;
> - anything the next phase must know, e.g. a record that wasn't created.
