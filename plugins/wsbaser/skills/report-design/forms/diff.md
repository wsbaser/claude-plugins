---
when: the proposal changes existing code; short diffs inline, long ones folded with the line count
---

# Diff

## When it fits

Use it when an option or a fix changes code that exists: the reader sees exactly what is removed and added. Do not use it for new code with no previous version (show it as code), or for a change so large that a summary and one representative hunk say more.

## How to build it

Block: `{ "form": "diff", "file": "src/Sync.Gateway/Middleware/RequestLogMiddleware.cs", "note": "the whole fix", "code": "@@ -32,2 +32,2 @@ ...\n-        var user = ...\n+        var user = ..." }`.

- `code` is unified diff text: hunk headers `@@ ... @@`, then lines starting with `-`, `+` or a space. Keep the real line numbers in the hunk headers.
- Take it from `git diff` or write it against the file you read; do not reformat unchanged lines.
- When the change repeats across many places, show one hunk inline with a note such as "1 of 6", and put the full diff in a fold.

On the page: the same `<figure class="code">` frame as code. Each line is a `<span class="l">` with a gutter `<span class="g">` holding `+`, `-` or a space. Added lines get class `add` (background `--pass-soft`, gutter `--pass`), removed lines class `del` (background `--fail-soft`, gutter `--fail`), hunk headers class `hunk` (`--muted`). Escape `<`, `>` and `&`.

## On the page

Full column width, lines scroll inside the `<pre>`. A diff of 600 characters or more that most readers will skip goes into a fold labelled with its size, for example "Full diff, 48 lines"; keep a short representative hunk inline above the fold so the change is understood without opening it. A short diff is always inline.
