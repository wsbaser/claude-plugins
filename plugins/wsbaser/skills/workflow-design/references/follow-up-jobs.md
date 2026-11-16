# Follow-up jobs (`followUps`)

A follow-up is one unattended agent session the engine queues when a run ends. It runs after the run, never delays the Feature and never changes its status; it ends with a report. Use one for work worth doing after the result has landed (notes, a slow extra check, a summary across several Features). Anything the Feature's success depends on is not a follow-up: that is a stage.

`followUps` is a list at the workflow root. Each entry:

| Key | Required | Allowed values | Default |
|---|---|---|---|
| `id` | yes | `^[a-z][a-z0-9-]{0,63}$`, unique among the workflow's follow-ups | — |
| `label` | yes | non-empty text, shown on the job | — |
| `runOn` | no | non-empty list, no duplicates, of `success`, `failed`, `stopped` (run outcome; `failed` covers failed, partial and aborted runs) | `[success]` |
| `priority` | no | integer 0..100; higher starts first | 50 |
| `coalesceKey` | no | template over `{{featureId}}`, `{{artifactHandle}}` and stage output names | none (every request is its own job) |
| `stagePrompt` | yes | non-empty text: the job's user prompt | — |
| `stageSystemPrompt` | yes | non-empty text: the StageComplete instructions | — |
| `model` | no | model alias, e.g. `claude-sonnet` | the registry's default Claude model (not the run's model) |
| `timeoutMs` | no | integer 60 000..86 400 000 | 43 200 000 (12 hours) |

No other key is allowed; the loader rejects the workflow.

## Run variables

When the run ends the engine collects its variables: `featureId`, `artifactHandle` (when set), then, stage by stage in the workflow's stage order, every output whose value is a string, taken from that stage's newest successful attempt. A later stage overrides an earlier one of the same name. List and JSON-object values, and stages without a successful attempt, contribute nothing.

## Working directory

`parentWorkDir` is a stage output, not an engine value: the `isolate` stage of `quality-execute-plan` declares it as the Parent Worktree's absolute path. When the run's variables hold `parentWorkDir`, the job runs there; otherwise it runs in the project root. If that directory no longer exists when the job starts, the job is cancelled with `parentWorkDir no longer exists`.

## Prompt rules

- The job runs unattended and never asks: no `AskUserQuestion`, no waiting for a human. If it cannot go on, it completes with `status: 'abort'`.
- `stageSystemPrompt` ends the job with the StageComplete MCP tool: `stageId` is the follow-up's `id`; `status` is `'success'` or `'abort'` (never `'loop'`); `summary` as for stages; on `abort` a non-empty `reason` (the call is rejected without one; the job shows the `summary` as why it failed, so say it there too); and always `outputs: { report: <path> }`. The engine keeps the report only when the file exists inside the job's working directory; without it the job shows no report.
- The `report` path is relative to the working directory, by convention `.reports/follow-ups/{{jobId}}/report.md`: unique per job, because two jobs of one key can run at once when the project allows more than one job. A job that works elsewhere writes or copies the report there before it ends.
- Both prompts may read the run variables, `{{requesters}}` (comma-separated ids of every Feature that asked for this job) and `{{jobId}}`.
- A job that changes code makes its own worktree and lands like the `merge-back` stage (read it with `GetWorkflow`); it never edits the Parent Worktree in place.
- Heavy commands (builds, test suites) run as `"$ASK_JENNY_LOCK_BIN" heavy -- <command>`.

## Coalescing

`coalesceKey` is rendered when the run ends. A request whose rendered key matches a job still waiting in the project's queue joins that job instead of queuing another: the job keeps one run and adds the Feature to `{{requesters}}`; the request replaces the job's inputs (run variables), label, model, timeoutMs and run-as user, and the job takes the higher of the two priorities. The key may use only `{{featureId}}`, `{{artifactHandle}}` and stage output names (never `{{requesters}}` or `{{jobId}}`). Keys are shared across the project, so start each with the follow-up's id.

## Example

```yaml
# followUps example (validated)
followUps:
  - id: release-notes
    label: Release notes draft
    runOn: [success]
    priority: 50
    coalesceKey: 'release-notes:{{parentBranch}}'
    model: claude-sonnet
    timeoutMs: 3600000
    stagePrompt: |
      You run unattended: never ask a question; if you cannot go on, complete with
      status 'abort' and the reason. Read the commits that landed on {{parentBranch}} for
      {{requesters}} and draft release notes. Write them to
      .reports/follow-ups/{{jobId}}/report.md.
    stageSystemPrompt: |
      Call the StageComplete MCP tool as the LAST action before stopping, with stageId
      'release-notes': status 'success', a one-sentence summary, and
      outputs: { report: .reports/follow-ups/{{jobId}}/report.md }. On failure: status
      'abort', the reason as both summary and reason, the same report output.
```

`{{parentBranch}}` here is a text output of an earlier stage. An unknown token fails the load in `coalesceKey`; in a prompt it loads with a warning and reaches the agent verbatim.
