# Report Generation

This skill writes its own report by hand each run — no bundled template, no bundled script, no other skill invoked. What follows is only the parts a competent agent wouldn't otherwise land on: the specific data this skill's whole premise depends on, the constraints a report can silently violate without knowing it, and the one technique that avoids a real, silent failure mode. Everything else — colors, fonts, the mechanism behind navigation or a copy button — is yours to decide each run; two reports satisfying the rules below can look completely different and both be correct.

The report exists to answer one question without the reader doing any work: **did it actually work, and if not, exactly what broke.** Every rule below serves that; nothing here is decoration.

## Data that must be captured (this is the report's whole point)

- **Which `.feature` file / `Feature:` title each scenario came from.** The report must let a reader see the scenarios grouped by their source file, not as one flat list — this is specific to how bdd-scenarios organizes scenarios and isn't something the report can reconstruct after the fact if it's dropped.
- **Per `Then` step: the expected value alongside what was actually extracted from the page**, not just a pass/fail flag. "Verified" proves nothing to a reader; "expected 80.00, read 80.00 from the Price excl. VAT cell" does.
- **Per issue, everything another Claude session would need to fix it with zero other context**: the symptom (expected vs. actual), severity (from the scenario's `@severity-*` tag — collapse `critical`→`high`/`minimal`→`low` if the vocabulary differs — else judged by impact), `file:line` from the root-cause grep, plain-English repro steps, the verbatim console error if any, and the 5-15 line code snippet plus a one-line explanation naming what in the code causes it. For a scenario blocked on missing preconditions/auth rather than a real bug, fill the same slot with a plain statement of what's blocked and why — a reader should never have to guess why a scenario has no verdict.
- **Which specific step an issue belongs to.** A scenario can have four steps and one culprit — know which one, so the report can point at it instead of the reader having to work it out.
- **Every screenshot's real absolute path** in the target repo, which scenario/step it belongs to. (Capture-then-`mv`, per `SKILL.md` Step 3, can land it somewhere other than where the browser tool was first told to write — capture the path it actually ends up at.)

## Readability — the report has one reader, skimming

A reader opens this to avoid doing the verification themselves. Every rule here exists so they never have to scroll, hunt, or parse a paragraph to get the answer a glance should give them.

- **The navigation tree stays on screen while scrolling** (sticky/fixed sidebar, not a table-of-contents that scrolls away with the page) — every Feature and its scenarios visible at once, each a click to its scenario. A nav block sitting inline at the top of the page and then scrolling out of view does not satisfy this.
- **A scenario's status reads as `pass`/`issue`/`fail` before anything else about it, and if it's not `pass`, the reason sits immediately beside or below the title** — never after the step list, never in a section the reader has to keep scrolling to reach. The steps come after the verdict, not before it.
- **The step that actually caused the issue is visually marked *in the step list itself*** — a distinct border/background/marker on that one step's row — not only described in prose elsewhere. A reader scanning the list top to bottom should be able to spot the culprit without reading every description.
- **When a `Then` genuinely fails, expected and actual are visually opposed, not just mentioned in the same sentence** — e.g. a labeled expected/actual pair, or the wrong value struck through/colored — so the mismatch registers on sight, the way a diff does.
- **Render each step with real Gherkin syntax highlighting, not just a bolded leading keyword.** The keyword (`Given`/`When`/`Then`/`And`/`But`) is one token among several worth distinguishing — quoted strings and literal values, numbers, and tags (`@severity-high`) each deserve their own visual treatment too, the way a Gherkin-aware editor renders a `.feature` file. A step is structured data; render it as structured data, not a sentence with one word in bold.
- **Use space in proportion to the information it holds.** A header or stats strip showing a handful of short values (a title, a date, five counts) shouldn't consume screen real estate as if it were the report's main content — generous padding on a near-empty row pushes everything a reader actually wants below the fold for nothing. Reserve the room for where the information density actually is: the scenarios and their evidence.
- **Nothing appears as a finding unless it actually changed the verdict.** A console error, a network hiccup, anything else observed but judged irrelevant to the scenario's own behavior does not get its own issue box — if it didn't move the scenario off `pass`, presenting it as a result is noise, not signal.

## Hard constraints

- **Single self-contained `.html` file** — no external resources, no CDN, no `file://` references. It has to be viewable standalone after `.reports/screenshots/` is deleted.
- **Screenshots embedded as `data:` URIs, clickable to view full-size** — a thumbnail that can't be enlarged isn't evidence, it's decoration.
- **Overwrite protection**: if `.reports/{slug}.html` already exists, don't silently clobber it — try `{slug}-2.html`, `{slug}-3.html`, etc.
- **A run where every scenario ends up blocked/issue still produces a report.** "Nothing could be verified, here's exactly why" is a valid, honest result — it is not a reason to skip writing the file.

## One constraint on the embedding step

A screenshot's base64 form is easily 100K+ characters. It must never pass through your own context — not via `Read` (truncates silently), not as a Bash argument, not typed into a `Write` call by you. This isn't a style preference; it's a real, silent failure mode this skill has actually hit while being built. Whatever mechanism you use to get a screenshot's bytes into the final HTML, the base64 text itself must exist only on disk and inside a process you spawn to do the encoding — never inside your own context window.
