---
when: the explanation is about specific lines of code; show them with file and line, highlight the lines the prose names
---

# Code

## When it fits

Use it whenever a sentence makes a claim about code: the reader checks the claim against the lines instead of trusting it. Show the smallest excerpt that holds the claim, usually 3 to 15 lines. Do not use it for a change to code (that is a diff), and do not paste a whole file.

## How to build it

Block: `{ "form": "code", "file": "src/Sync.Client/SyncSession.cs", "start": 112, "highlight": [114, 115], "note": "Error 2", "code": "..." }`.

- `file` is the path from the repository root; `start` is the real line number of the first line; `highlight` lists the real line numbers the prose names; `note` is an optional short label; `code` is the excerpt with its original indentation.
- Copy the lines from the file you read. Never retype or tidy them.
- The sentence before the block gives `file:line`.

On the page: a `<figure class="code">` with a `<figcaption>` (file on the left, note on the right, `--font-mono`, `--fs-xs`, `--muted`) and a `<pre>` holding one `<span class="l">` per line. Each line starts with its number in a `<span class="n">` (right aligned, `--muted`, `user-select: none`). A highlighted line gets class `hl`: background `--warn-soft` and a 2px inset left shadow in `--warn-line`. Background `--page`, border 1px `--line`, radius 8px, font `--font-mono` at 12px. Escape `<`, `>` and `&` in the code.

## On the page

Full column width. Long lines scroll inside the `<pre>` (`overflow-x: auto`), never the page. Two excerpts that are read against each other ("what we wrote" and "what the compiler generated") sit side by side in a two-column grid that becomes one column below 900px. An excerpt under 600 characters is never folded; a longer one that only some readers need goes into a fold whose label gives the line count.
